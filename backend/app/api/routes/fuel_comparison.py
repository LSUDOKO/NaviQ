"""Well-to-Wake fuel analysis and shore power evaluation."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...core.emissions.shore_power import evaluate_shore_power, list_ports
from ...core.emissions.wtw_calculator import compare_fuels
from ...core.physics.fuel_conversion import list_fuels
from ...database import get_db
from ...models import Vessel

router = APIRouter(prefix="/emissions", tags=["emissions"])


@router.get("/wtw")
def wtw_comparison(energy_mj: float = Query(350000.0, gt=0),
                   baseline: str = "HFO"):
    """Well-to-Wake comparison across every fuel for a given energy demand."""
    return compare_fuels(energy_mj, baseline=baseline)


@router.get("/fuel-properties")
def fuel_properties():
    """Fuel database with carbon intensity computed per MJ, for the matrix view."""
    fuels = list_fuels()
    for fuel in fuels:
        lhv = float(fuel["lhv_mj_per_kg"])
        # Carbon intensity per unit energy is the only fair basis for comparing
        # fuels whose energy density differs by a factor of six.
        fuel["ci_ttw_gco2e_per_mj"] = round(
            float(fuel["ef_ttw_gco2e_per_gfuel"]) * 1000.0 / lhv, 3)
        fuel["ci_wtw_gco2e_per_mj"] = round(
            float(fuel["ef_ttw_gco2e_per_gfuel"]) * 1000.0 / lhv
            + float(fuel["ef_wtt_gco2e_per_mj"]), 3)
        fuel["cost_usd_per_gj"] = round(
            float(fuel["price_usd_per_tonne"]) / (lhv * 1000.0) * 1e6 / 1e3, 2)
    return fuels


@router.get("/shore-power")
def shore_power_matrix(berth_hours: float = Query(30.0, gt=0, le=500),
                       db: Session = Depends(get_db)):
    """Shore power economics for every vessel at every port."""
    vessels = db.query(Vessel).all()
    ports = list_ports()

    matrix = []
    for vessel in vessels:
        data = vessel.to_dict()
        evaluations = [evaluate_shore_power(data, port["id"], berth_hours) for port in ports]
        matrix.append({
            "vessel_id": data["id"], "vessel_name": data["name"],
            "shore_power_capable": data["shore_power_capable"],
            "ports": evaluations,
            "n_feasible": sum(1 for e in evaluations if e["feasible"]),
            "n_recommended": sum(1 for e in evaluations if e["recommended"]),
            "total_ghg_saving_t": round(
                sum(e["ghg_saving_wtw_t"] for e in evaluations if e["recommended"]), 3),
        })

    return {
        "berth_hours": berth_hours,
        "vessels": matrix,
        "ports": ports,
        "fleet_ghg_saving_t": round(sum(m["total_ghg_saving_t"] for m in matrix), 3),
    }


@router.get("/shore-power/{vessel_id}/{port_id}")
def shore_power_detail(vessel_id: str, port_id: str,
                       berth_hours: float = Query(30.0, gt=0, le=500),
                       db: Session = Depends(get_db)):
    vessel = db.get(Vessel, vessel_id)
    if vessel is None:
        raise HTTPException(404, f"Vessel '{vessel_id}' not found")
    try:
        return evaluate_shore_power(vessel.to_dict(), port_id, berth_hours)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
