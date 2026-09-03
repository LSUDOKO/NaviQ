"""Fuel prediction endpoints."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.emissions.wtw_calculator import compare_fuels
from ...core.optimization.objectives import build_legs
from ...core.physics.fuel_conversion import list_fuels
from ...core.physics.weather import generate_route_weather
from ...core.prediction.predictor import get_predictor
from ...database import get_db
from ...models import Route, Vessel
from ...schemas import PredictionRequest

router = APIRouter(tags=["prediction"])


def _resolve_route(payload: PredictionRequest, db: Session) -> dict:
    if payload.route_id:
        route = db.get(Route, payload.route_id)
        if route is None:
            raise HTTPException(404, f"Route '{payload.route_id}' not found")
        return route.to_dict()

    if payload.waypoints:
        if len(payload.waypoints) < 2:
            raise HTTPException(422, "At least two waypoints are required")
        return {
            "id": "ADHOC", "name": "Custom route",
            "waypoints": payload.waypoints,
            "eta_window_hours": [0.0, 1e9],
            "origin_port": "", "destination_port": "",
            "distance_nm": 0.0, "cargo_demand_t": 0.0, "revenue_usd": 0.0,
        }

    raise HTTPException(422, "Provide either route_id or waypoints")


@router.post("/predict")
def predict(payload: PredictionRequest, db: Session = Depends(get_db)):
    """Predict voyage fuel with uncertainty and a physics breakdown."""
    vessel = db.get(Vessel, payload.vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{payload.vessel_id}' not found")

    vessel_data = vessel.to_dict()
    route_data = _resolve_route(payload, db)
    n_legs = max(1, len(route_data["waypoints"]) - 1)

    # Speeds: explicit per-leg, a single constant, or the vessel's service speed.
    if payload.speeds_kn:
        if len(payload.speeds_kn) != n_legs:
            raise HTTPException(422, f"Route has {n_legs} legs, got {len(payload.speeds_kn)} speeds")
        speeds = np.array(payload.speeds_kn, dtype=float)
    else:
        speed = payload.speed_kn or vessel_data["speed_service_kn"]
        if not (vessel_data["speed_min_kn"] <= speed <= vessel_data["speed_max_kn"]):
            raise HTTPException(422,
                f"Speed {speed} kn is outside this vessel's range "
                f"[{vessel_data['speed_min_kn']}, {vessel_data['speed_max_kn']}]")
        speeds = np.full(n_legs, float(speed))

    if payload.weather is not None:
        weather = [payload.weather.model_dump() for _ in range(n_legs)]
        weather_source = "user"
    else:
        weather = generate_route_weather(route_data, month=payload.month)
        weather_source = "climatology"

    legs = build_legs(route_data, speeds, weather)
    result = get_predictor().predict(vessel_data, legs, payload.fuel_id,
                                     n_samples=payload.mc_samples)

    result["vessel"] = {"id": vessel_data["id"], "name": vessel_data["name"],
                        "ship_type": vessel_data["ship_type"], "dwt": vessel_data["dwt"]}
    result["route"] = {"id": route_data["id"], "name": route_data["name"],
                       "waypoints": route_data["waypoints"]}
    result["weather"] = weather
    result["weather_source"] = weather_source
    result["speeds_kn"] = [round(float(s), 2) for s in speeds]
    result["fuel_id"] = payload.fuel_id
    return result


@router.get("/fuels")
def get_fuels():
    """The fuel property database, including WtW factors and prices."""
    return list_fuels()


@router.post("/emissions/compare")
def compare_route_fuels(payload: PredictionRequest, db: Session = Depends(get_db)):
    """Well-to-Wake comparison of every compatible fuel on one voyage."""
    vessel = db.get(Vessel, payload.vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{payload.vessel_id}' not found")

    vessel_data = vessel.to_dict()
    route_data = _resolve_route(payload, db)
    n_legs = max(1, len(route_data["waypoints"]) - 1)
    speed = payload.speed_kn or vessel_data["speed_service_kn"]
    speeds = np.full(n_legs, float(speed))

    weather = ([payload.weather.model_dump() for _ in range(n_legs)]
               if payload.weather else generate_route_weather(route_data, month=payload.month))
    legs = build_legs(route_data, speeds, weather)

    prediction = get_predictor().predict_physics(vessel_data, legs, vessel_data["current_fuel"])
    energy_mj = prediction["energy_mj"]

    comparison = compare_fuels(energy_mj, baseline=vessel_data["current_fuel"])

    # Flag which fuels this hull can actually burn without a retrofit.
    compatible = set(vessel_data["compatible_fuels"])
    for entry in comparison["fuels"]:
        entry["vessel_compatible"] = entry["fuel_id"] in compatible

    comparison["vessel"] = {"id": vessel_data["id"], "name": vessel_data["name"],
                            "current_fuel": vessel_data["current_fuel"],
                            "compatible_fuels": vessel_data["compatible_fuels"]}
    comparison["route"] = {"id": route_data["id"], "name": route_data["name"]}
    comparison["voyage"] = {
        "distance_nm": prediction["distance_nm"],
        "duration_hours": prediction["duration_hours"],
        "speed_kn": speed,
        "energy_mj": energy_mj,
    }
    comparison["physics_breakdown"] = prediction["physics_breakdown"]
    return comparison


@router.get("/model/info")
def model_info():
    """Which prediction path is live, and its validation metrics."""
    predictor = get_predictor()
    return {
        "mode": predictor.mode,
        "neural_available": predictor.model is not None,
        "metrics": predictor.metrics,
        "description": (
            "Physics-informed BiLSTM with time-aware self-attention and Monte Carlo "
            "Dropout uncertainty." if predictor.mode == "neural" else
            "Analytic Holtrop-Mennen resistance chain; neural weights not loaded."
        ),
    }
