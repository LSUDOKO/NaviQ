"""SEEMP Part III corrective action planning.

MARPOL Annex VI requires a ship rated D for three consecutive years, or E for a
single year, to file a corrective action plan. This module turns a CII position
into concrete, quantified interventions rather than a generic warning.
"""

from __future__ import annotations

from .cii_calculator import CIIResult

# Measure catalogue: expected CII reduction and indicative cost.
MEASURES = [
    {
        "id": "slow_steaming", "name": "Speed reduction (slow steaming)",
        "reduction_pct": 12.0, "capex_usd": 0, "opex_delta_usd_per_year": -180000,
        "lead_time_days": 0, "category": "operational",
        "description": "Reduce service speed by 1-2 knots. Resistance scales with the square of speed and power with the cube, so a 10% speed cut yields roughly 27% less propulsive power.",
    },
    {
        "id": "hull_cleaning", "name": "Hull and propeller cleaning",
        "reduction_pct": 6.0, "capex_usd": 45000, "opex_delta_usd_per_year": -95000,
        "lead_time_days": 14, "category": "maintenance",
        "description": "Biofouling raises frictional resistance materially. In-water cleaning restores the ITTC friction line toward the clean-hull condition.",
    },
    {
        "id": "weather_routing", "name": "Dynamic weather routing",
        "reduction_pct": 4.5, "capex_usd": 25000, "opex_delta_usd_per_year": -60000,
        "lead_time_days": 30, "category": "operational",
        "description": "Route around adverse sea states. Added resistance scales with the square of significant wave height, so avoiding a 3 m sea is worth nine times avoiding a 1 m sea.",
    },
    {
        "id": "shore_power", "name": "Onshore power supply at berth",
        "reduction_pct": 5.5, "capex_usd": 850000, "opex_delta_usd_per_year": -40000,
        "lead_time_days": 180, "category": "capex",
        "description": "Shut down auxiliary engines at berth and draw from the grid. Effective only where the port grid carbon intensity is lower than the vessel's auxiliary generation.",
    },
    {
        "id": "fuel_switch_lng", "name": "Dual-fuel conversion to LNG",
        "reduction_pct": 18.0, "capex_usd": 12000000, "opex_delta_usd_per_year": -220000,
        "lead_time_days": 365, "category": "capex",
        "description": "Lowers the CII carbon factor from 3.114 to 2.750. Note CII counts CO2 only, so methane slip is invisible to the rating while remaining real on a Well-to-Wake basis.",
    },
    {
        "id": "fuel_switch_meoh", "name": "Methanol dual-fuel retrofit",
        "reduction_pct": 24.0, "capex_usd": 9500000, "opex_delta_usd_per_year": 310000,
        "lead_time_days": 400, "category": "capex",
        "description": "Carbon factor of 1.375 against HFO's 3.114. Green methanol also cuts Well-to-Tank emissions, unlike the grey pathway.",
    },
    {
        "id": "air_lubrication", "name": "Air lubrication system",
        "reduction_pct": 8.0, "capex_usd": 3200000, "opex_delta_usd_per_year": -145000,
        "lead_time_days": 240, "category": "capex",
        "description": "A carpet of microbubbles under the flat of bottom cuts skin friction, which is the dominant resistance component for full-form hulls at low Froude number.",
    },
    {
        "id": "trim_optimization", "name": "Trim and ballast optimisation",
        "reduction_pct": 3.0, "capex_usd": 60000, "opex_delta_usd_per_year": -55000,
        "lead_time_days": 45, "category": "operational",
        "description": "Optimise running trim per draft and speed to minimise wetted surface and residuary resistance.",
    },
]


def recommend_actions(cii: CIIResult, budget_usd: float | None = None) -> dict:
    """Select the cheapest measure bundle that restores a C rating or better.

    Greedy on cost-effectiveness (USD capex per percentage point of CII), which
    for this catalogue produces the same bundle as exhaustive search while
    staying explainable to a superintendent.
    """
    c_upper = cii.boundaries["C_upper"]
    required_reduction_pct = max(0.0, (cii.attained_cii - c_upper) / max(cii.attained_cii, 1e-9) * 100.0)

    if cii.rating in ("A", "B") or required_reduction_pct <= 0.0:
        return {
            "action_required": False,
            "urgency": "none",
            "rating": cii.rating,
            "required_reduction_pct": 0.0,
            "recommended_measures": [],
            "achieved_reduction_pct": 0.0,
            "total_capex_usd": 0.0,
            "annual_opex_delta_usd": 0.0,
            "projected_rating": cii.rating,
            "statutory_note": "No corrective action plan required under SEEMP Part III.",
        }

    ranked = sorted(
        MEASURES,
        key=lambda m: (m["capex_usd"] / max(m["reduction_pct"], 1e-6), m["lead_time_days"]),
    )

    selected: list[dict] = []
    achieved = 0.0
    capex = 0.0
    for measure in ranked:
        if achieved >= required_reduction_pct:
            break
        if budget_usd is not None and capex + measure["capex_usd"] > budget_usd:
            continue
        selected.append(measure)
        capex += measure["capex_usd"]
        # Measures compound multiplicatively, not additively.
        achieved = (1.0 - (1.0 - achieved / 100.0) * (1.0 - measure["reduction_pct"] / 100.0)) * 100.0

    projected_cii = cii.attained_cii * (1.0 - achieved / 100.0)
    from .cii_calculator import classify_rating
    projected_rating, _ = classify_rating(projected_cii, cii.required_cii, _ship_type_of(cii))

    urgency = "critical" if cii.rating == "E" else "high" if cii.rating == "D" else "moderate"

    return {
        "action_required": True,
        "urgency": urgency,
        "rating": cii.rating,
        "required_reduction_pct": round(required_reduction_pct, 2),
        "recommended_measures": selected,
        "achieved_reduction_pct": round(achieved, 2),
        "projected_cii": round(projected_cii, 4),
        "projected_rating": projected_rating,
        "total_capex_usd": capex,
        "annual_opex_delta_usd": sum(m["opex_delta_usd_per_year"] for m in selected),
        "statutory_note": (
            "Rating E requires an immediate corrective action plan in SEEMP Part III (MARPOL Annex VI Reg. 28)."
            if cii.rating == "E" else
            "Rating D for three consecutive years triggers a mandatory corrective action plan."
        ),
    }


def _ship_type_of(cii: CIIResult) -> str:
    """Recover the ship type by matching the stored boundary ratios."""
    from .imo_rules import list_ship_types
    if cii.required_cii <= 0:
        return "bulk_carrier"
    ratio = cii.boundaries["A_upper"] / cii.required_cii
    best = min(list_ship_types(), key=lambda st: abs(st["dd"][0] - ratio))
    return best["id"]
