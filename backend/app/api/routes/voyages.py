"""Routes catalogue and voyage records."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.compliance.cii_calculator import calculate_cii
from ...core.emissions.shore_power import list_ports
from ...core.emissions.wtw_calculator import compute_emissions
from ...core.optimization.objectives import build_legs
from ...core.physics.propulsion import integrate_voyage_energy
from ...core.physics.weather import generate_forecast_grid, generate_route_weather
from ...database import get_db
from ...models import Route, Vessel, Voyage
from ...schemas import VoyageCreate

router = APIRouter(tags=["voyages"])


@router.get("/routes")
def list_routes(db: Session = Depends(get_db)):
    return [r.to_dict() for r in db.query(Route).all()]


@router.get("/routes/{route_id}")
def get_route(route_id: str, month: int = 7, db: Session = Depends(get_db)):
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(404, f"Route '{route_id}' not found")
    data = route.to_dict()
    data["weather"] = generate_route_weather(data, month=month)
    return data


@router.get("/routes/{route_id}/forecast")
def route_forecast(route_id: str, days: int = 7, month: int = 7, db: Session = Depends(get_db)):
    route = db.get(Route, route_id)
    if route is None:
        raise HTTPException(404, f"Route '{route_id}' not found")
    return {"route_id": route_id, "forecast": generate_forecast_grid(route.to_dict(), days, month)}


@router.get("/ports")
def get_ports():
    return list_ports()


@router.get("/voyages")
def list_voyages(limit: int = 50, db: Session = Depends(get_db)):
    voyages = db.query(Voyage).order_by(Voyage.created_at.desc()).limit(limit).all()
    return [v.to_dict() for v in voyages]


@router.post("/voyages", status_code=201)
def create_voyage(payload: VoyageCreate, db: Session = Depends(get_db)):
    """Record a voyage, computing its fuel, emissions and CII from the physics engine."""
    vessel = db.get(Vessel, payload.vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{payload.vessel_id}' not found")
    route = db.get(Route, payload.route_id)
    if route is None:
        raise HTTPException(404, f"Route '{payload.route_id}' not found")

    vessel_data = vessel.to_dict()
    route_data = route.to_dict()

    if payload.fuel_id not in vessel_data["compatible_fuels"]:
        raise HTTPException(422,
            f"Vessel {vessel.name} cannot burn {payload.fuel_id}. "
            f"Compatible: {vessel_data['compatible_fuels']}")

    n_legs = max(1, len(route_data["waypoints"]) - 1)
    if payload.speeds_kn:
        if len(payload.speeds_kn) != n_legs:
            raise HTTPException(422, f"Route has {n_legs} legs, got {len(payload.speeds_kn)} speeds")
        speeds = np.array(payload.speeds_kn, dtype=float)
    else:
        speeds = np.full(n_legs, float(vessel_data["speed_service_kn"]))

    weather = generate_route_weather(route_data, month=7)
    legs = build_legs(route_data, speeds, weather)
    voyage_energy = integrate_voyage_energy(vessel_data, legs)

    emissions = compute_emissions(voyage_energy["total_energy_mj"], payload.fuel_id)
    cii = calculate_cii(vessel_data["ship_type"], vessel_data["dwt"],
                        voyage_energy["total_distance_nm"],
                        {payload.fuel_id: emissions.fuel_mass_t})

    voyage = Voyage(
        id=str(uuid.uuid4()),
        vessel_id=payload.vessel_id, route_id=payload.route_id, fuel_id=payload.fuel_id,
        departure=payload.departure or datetime.now(timezone.utc),
        status="planned",
        distance_nm=voyage_energy["total_distance_nm"],
        duration_hours=voyage_energy["total_duration_hours"],
        fuel_tonnes=emissions.fuel_mass_t,
        fuel_cost_usd=emissions.fuel_cost_usd,
        co2_ttw_t=emissions.co2_ttw_t,
        ghg_wtw_t=emissions.ghg_wtw_t,
        cii_attained=cii.attained_cii,
        cii_rating=cii.rating,
        speed_profile=json.dumps([
            {"leg": i, "speed_kn": round(float(s), 2),
             "distance_nm": round(legs[i]["distance_nm"], 2)}
            for i, s in enumerate(speeds)
        ]),
    )
    db.add(voyage)
    db.commit()
    db.refresh(voyage)

    result = voyage.to_dict()
    result["cii_detail"] = cii.to_dict()
    result["emissions_detail"] = emissions.to_dict()
    return result


@router.get("/voyages/{voyage_id}")
def get_voyage(voyage_id: str, db: Session = Depends(get_db)):
    voyage = db.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(404, f"Voyage '{voyage_id}' not found")
    return voyage.to_dict()


@router.delete("/voyages/{voyage_id}", status_code=204)
def delete_voyage(voyage_id: str, db: Session = Depends(get_db)):
    voyage = db.get(Voyage, voyage_id)
    if voyage is None:
        raise HTTPException(404, f"Voyage '{voyage_id}' not found")
    db.delete(voyage)
    db.commit()
