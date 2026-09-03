"""Vessel CRUD and per-vessel analytics."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.compliance.cii_calculator import calculate_cii
from ...core.physics.fuel_conversion import energy_to_fuel_mass, list_fuels
from ...core.physics.propulsion import compute_propulsion
from ...database import get_db
from ...models import Vessel
from ...schemas import VesselCreate, VesselOut, VesselUpdate

router = APIRouter(prefix="/vessels", tags=["vessels"])

CALM_REFERENCE = {
    "wind_speed_kn": 10.0, "wind_direction_deg": 60.0,
    "wave_height_m": 1.5, "wave_period_s": 8.0, "wave_direction_deg": 60.0,
    "current_speed_kn": 0.0, "current_direction_deg": 0.0,
}


def _annual_cii(vessel: dict, year: int = 2026) -> dict:
    """Annual CII from the vessel's service speed and declared annual distance."""
    distance = float(vessel["annual_distance_nm"])
    hours = distance / max(float(vessel["speed_service_kn"]), 1e-6)
    state, _ = compute_propulsion(vessel, vessel["speed_service_kn"], 90.0, CALM_REFERENCE)
    energy_mj = state.total_power_kw * hours * 3.6
    mass_t = energy_to_fuel_mass(energy_mj, vessel["current_fuel"])
    result = calculate_cii(vessel["ship_type"], vessel["dwt"], distance,
                           {vessel["current_fuel"]: mass_t}, year)
    payload = result.to_dict()
    payload["annual_fuel_tonnes"] = round(mass_t, 2)
    payload["annual_energy_mj"] = round(energy_mj, 1)
    return payload


@router.get("", response_model=list[VesselOut])
def list_vessels(db: Session = Depends(get_db)):
    return [VesselOut(**v.to_dict()) for v in db.query(Vessel).all()]


@router.get("/summary")
def vessels_summary(year: int = 2026, db: Session = Depends(get_db)):
    """Every vessel with its current CII rating, for the fleet grid."""
    out = []
    for vessel in db.query(Vessel).all():
        data = vessel.to_dict()
        cii = _annual_cii(data, year)
        out.append({
            **data,
            "cii": cii,
            "rating": cii["rating"],
            "attained_cii": cii["attained_cii"],
            "required_cii": cii["required_cii"],
        })
    return out


@router.get("/{vessel_id}", response_model=VesselOut)
def get_vessel(vessel_id: str, db: Session = Depends(get_db)):
    vessel = db.get(Vessel, vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{vessel_id}' not found")
    return VesselOut(**vessel.to_dict())


@router.get("/{vessel_id}/detail")
def vessel_detail(vessel_id: str, year: int = 2026, db: Session = Depends(get_db)):
    """Vessel with CII, a speed-power curve and fuel options."""
    vessel = db.get(Vessel, vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{vessel_id}' not found")
    data = vessel.to_dict()

    # Speed-power curve: the cubic law made visible, which is the single most
    # persuasive chart for justifying slow steaming to an operator.
    curve = []
    v_min, v_max = data["speed_min_kn"], data["speed_max_kn"]
    for i in range(13):
        speed = v_min + (v_max - v_min) * i / 12.0
        state, resistance = compute_propulsion(data, speed, 90.0, CALM_REFERENCE)
        hours = 1000.0 / max(speed, 1e-6)  # fuel per 1000 nm, a comparable basis
        energy_mj = state.total_power_kw * hours * 3.6
        curve.append({
            "speed_kn": round(speed, 2),
            "shaft_power_kw": round(state.shaft_power_kw, 1),
            "engine_load_pct": round(state.engine_load_pct, 1),
            "resistance_kn": round(resistance.r_total_kn, 1),
            "fuel_per_1000nm_t": round(energy_to_fuel_mass(energy_mj, data["current_fuel"]), 2),
        })

    all_fuels = {f["id"]: f for f in list_fuels()}
    return {
        **data,
        "cii": _annual_cii(data, year),
        "speed_power_curve": curve,
        "fuel_options": [all_fuels[f] for f in data["compatible_fuels"] if f in all_fuels],
    }


@router.post("", response_model=VesselOut, status_code=201)
def create_vessel(payload: VesselCreate, db: Session = Depends(get_db)):
    vessel_id = payload.id or f"V{uuid.uuid4().hex[:6].upper()}"
    if db.get(Vessel, vessel_id) is not None:
        raise HTTPException(409, f"Vessel '{vessel_id}' already exists")

    if payload.current_fuel not in payload.compatible_fuels:
        raise HTTPException(422, "current_fuel must appear in compatible_fuels")

    data = payload.model_dump(exclude={"id", "compatible_fuels"})
    vessel = Vessel(id=vessel_id, compatible_fuels=json.dumps(payload.compatible_fuels), **data)
    db.add(vessel)
    db.commit()
    db.refresh(vessel)
    return VesselOut(**vessel.to_dict())


@router.put("/{vessel_id}", response_model=VesselOut)
def update_vessel(vessel_id: str, payload: VesselUpdate, db: Session = Depends(get_db)):
    vessel = db.get(Vessel, vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{vessel_id}' not found")

    updates = payload.model_dump(exclude_unset=True)
    if "compatible_fuels" in updates:
        vessel.compatible_fuels = json.dumps(updates.pop("compatible_fuels"))
    for key, value in updates.items():
        setattr(vessel, key, value)

    db.commit()
    db.refresh(vessel)
    return VesselOut(**vessel.to_dict())


@router.delete("/{vessel_id}", status_code=204)
def delete_vessel(vessel_id: str, db: Session = Depends(get_db)):
    vessel = db.get(Vessel, vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{vessel_id}' not found")
    db.delete(vessel)
    db.commit()
