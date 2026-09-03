"""CII compliance, scenario analysis and SEEMP recommendations."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.compliance.cii_calculator import calculate_cii
from ...core.compliance.imo_rules import (
    list_ship_types,
    load_cii_reference,
    rating_labels,
    reduction_factor,
)
from ...core.compliance.seemp import recommend_actions
from ...core.physics.fuel_conversion import energy_to_fuel_mass
from ...core.physics.propulsion import compute_propulsion
from ...database import get_db
from ...models import Vessel

router = APIRouter(prefix="/compliance", tags=["compliance"])

REFERENCE_WEATHER = {
    "wind_speed_kn": 10.0, "wind_direction_deg": 60.0,
    "wave_height_m": 1.5, "wave_period_s": 8.0, "wave_direction_deg": 60.0,
    "current_speed_kn": 0.0, "current_direction_deg": 0.0,
}


def _vessel_cii(vessel: dict, year: int, speed_override: float | None = None,
                fuel_override: str | None = None):
    speed = speed_override or vessel["speed_service_kn"]
    fuel_id = fuel_override or vessel["current_fuel"]
    distance = float(vessel["annual_distance_nm"])
    hours = distance / max(speed, 1e-6)
    state, _ = compute_propulsion(vessel, speed, 90.0, REFERENCE_WEATHER)
    energy_mj = state.total_power_kw * hours * 3.6
    mass_t = energy_to_fuel_mass(energy_mj, fuel_id)
    return calculate_cii(vessel["ship_type"], vessel["dwt"], distance,
                         {fuel_id: mass_t}, year), mass_t


@router.get("/cii")
def fleet_cii(year: int = 2026, db: Session = Depends(get_db)):
    """Fleet-wide CII with per-vessel detail and SEEMP actions where needed."""
    vessels = db.query(Vessel).all()
    entries = []
    distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "E": 0}

    total_co2 = 0.0
    total_transport_work = 0.0

    for vessel in vessels:
        data = vessel.to_dict()
        cii, mass_t = _vessel_cii(data, year)
        actions = recommend_actions(cii)
        distribution[cii.rating] += 1
        total_co2 += cii.co2_emissions_t
        total_transport_work += data["dwt"] * data["annual_distance_nm"]

        entries.append({
            "vessel_id": data["id"], "vessel_name": data["name"],
            "ship_type": data["ship_type"], "dwt": data["dwt"],
            "current_fuel": data["current_fuel"],
            "annual_distance_nm": data["annual_distance_nm"],
            "annual_fuel_tonnes": round(mass_t, 2),
            "cii": cii.to_dict(),
            "seemp": actions,
        })

    fleet_aer = (total_co2 * 1e6 / total_transport_work) if total_transport_work else 0.0
    non_compliant = [e for e in entries if not e["cii"]["is_compliant"]]

    return {
        "year": year,
        "reduction_factor_z_pct": reduction_factor(year),
        "vessels": entries,
        "rating_distribution": distribution,
        "fleet_aer_gco2_per_tnm": round(fleet_aer, 4),
        "fleet_co2_tonnes": round(total_co2, 2),
        "n_compliant": len(entries) - len(non_compliant),
        "n_non_compliant": len(non_compliant),
        "at_risk_vessels": [e["vessel_name"] for e in entries if e["cii"]["rating"] in ("D", "E")],
        "rating_labels": rating_labels(),
    }


@router.get("/cii/trajectory")
def cii_trajectory(start_year: int = 2023, end_year: int = 2032,
                   db: Session = Depends(get_db)):
    """Projected CII per vessel as the IMO reduction factor tightens each year.

    Holding operations constant, this is the cliff every operator faces: a
    vessel rated C today drifts to D and then E purely because the required
    line moves, without anything about the ship changing.
    """
    vessels = [v.to_dict() for v in db.query(Vessel).all()]
    years = list(range(start_year, end_year + 1))

    series = []
    for vessel in vessels:
        points = []
        for year in years:
            cii, _ = _vessel_cii(vessel, year)
            points.append({
                "year": year,
                "attained_cii": round(cii.attained_cii, 4),
                "required_cii": round(cii.required_cii, 4),
                "rating": cii.rating,
                "boundaries": {k: round(v, 4) for k, v in cii.boundaries.items()},
                "is_compliant": cii.is_compliant,
                "margin_pct": round(cii.margin_to_c_boundary_pct, 2),
            })
        first_breach = next((p["year"] for p in points if not p["is_compliant"]), None)
        series.append({
            "vessel_id": vessel["id"], "vessel_name": vessel["name"],
            "ship_type": vessel["ship_type"],
            "points": points,
            "first_non_compliant_year": first_breach,
        })

    return {
        "years": years,
        "reduction_factors": {str(y): reduction_factor(y) for y in years},
        "vessels": series,
    }


@router.post("/scenario")
def cii_scenario(payload: dict = Body(...), db: Session = Depends(get_db)):
    """What-if analysis: change Z, speed or fuel and see the rating move.

    Body: { year, reduction_factor_z_pct?, speed_delta_kn?, fuel_id?, vessel_ids? }
    """
    year = int(payload.get("year", 2026))
    z_override = payload.get("reduction_factor_z_pct")
    speed_delta = float(payload.get("speed_delta_kn", 0.0))
    fuel_override = payload.get("fuel_id")
    vessel_ids = payload.get("vessel_ids")

    query = db.query(Vessel)
    if vessel_ids:
        query = query.filter(Vessel.id.in_(vessel_ids))
    vessels = [v.to_dict() for v in query.all()]
    if not vessels:
        raise HTTPException(404, "No matching vessels")

    results = []
    for vessel in vessels:
        baseline, _ = _vessel_cii(vessel, year)

        new_speed = max(vessel["speed_min_kn"],
                        min(vessel["speed_max_kn"], vessel["speed_service_kn"] + speed_delta))
        fuel_id = fuel_override if fuel_override in vessel["compatible_fuels"] else vessel["current_fuel"]
        scenario, mass_t = _vessel_cii(vessel, year, speed_override=new_speed, fuel_override=fuel_id)

        scenario_dict = scenario.to_dict()
        # An explicit Z overrides the statutory one, for policy stress-testing.
        if z_override is not None:
            from ...core.compliance.cii_calculator import classify_rating, reference_cii
            ref = reference_cii(vessel["ship_type"], vessel["dwt"])
            required = ref * (1.0 - float(z_override) / 100.0)
            rating, bounds = classify_rating(scenario.attained_cii, required, vessel["ship_type"])
            scenario_dict.update({
                "required_cii": round(required, 6),
                "rating": rating,
                "boundaries": {k: round(v, 6) for k, v in bounds.items()},
                "reduction_factor_z": float(z_override),
                "is_compliant": scenario.attained_cii <= bounds["C_upper"],
                "margin_to_c_boundary_pct": round(
                    (bounds["C_upper"] - scenario.attained_cii) / max(bounds["C_upper"], 1e-9) * 100.0, 4),
            })

        results.append({
            "vessel_id": vessel["id"], "vessel_name": vessel["name"],
            "baseline": baseline.to_dict(),
            "scenario": scenario_dict,
            "applied": {
                "speed_kn": round(new_speed, 2),
                "speed_delta_kn": round(new_speed - vessel["speed_service_kn"], 2),
                "fuel_id": fuel_id,
                "reduction_factor_z_pct": z_override if z_override is not None else scenario.reduction_factor_z,
            },
            "annual_fuel_tonnes": round(mass_t, 2),
            "rating_changed": baseline.rating != scenario_dict["rating"],
            "cii_delta_pct": round(
                (scenario.attained_cii - baseline.attained_cii) / max(baseline.attained_cii, 1e-9) * 100.0, 2),
        })

    improved = sum(1 for r in results if r["scenario"]["is_compliant"] and not r["baseline"]["is_compliant"])
    degraded = sum(1 for r in results if not r["scenario"]["is_compliant"] and r["baseline"]["is_compliant"])

    return {
        "year": year, "results": results,
        "summary": {
            "vessels_analysed": len(results),
            "newly_compliant": improved,
            "newly_non_compliant": degraded,
            "mean_cii_delta_pct": round(sum(r["cii_delta_pct"] for r in results) / max(len(results), 1), 2),
        },
    }


@router.get("/reference")
def cii_reference_data():
    """IMO reference lines, reduction factors and rating boundaries."""
    reference = load_cii_reference()
    return {
        "ship_types": list_ship_types(),
        "reduction_factors": reference["reduction_factors_z_pct"],
        "rating_labels": rating_labels(),
        "formulas": {
            "reference_line": "CII_ref = a x Capacity^(-c)",
            "required": "CII_required = CII_ref x (1 - Z/100)",
            "aer": "AER = CO2 / (DWT x Distance)",
            "co2": "CO2 = sum_f (m_f x CF_f)",
        },
        "sources": reference["_meta"]["sources"],
    }
