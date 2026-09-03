"""Dashboard aggregation: the fleet-wide numbers shown on the landing page."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...core.compliance.cii_calculator import calculate_cii
from ...core.compliance.imo_rules import rating_labels, reduction_factor
from ...core.emissions.wtw_calculator import compute_emissions
from ...core.physics.fuel_conversion import energy_to_fuel_mass, get_fuel
from ...core.physics.propulsion import compute_propulsion
from ...core.physics.weather import generate_route_weather
from ...database import get_db
from ...models import OptimizationResult, Port, Route, Vessel
from ...tasks.optimization_task import registry

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

REFERENCE_WEATHER = {
    "wind_speed_kn": 10.0, "wind_direction_deg": 60.0,
    "wave_height_m": 1.5, "wave_period_s": 8.0, "wave_direction_deg": 60.0,
    "current_speed_kn": 0.0, "current_direction_deg": 0.0,
}


@router.get("/summary")
def dashboard_summary(year: int = 2026, db: Session = Depends(get_db)):
    """Fleet KPIs, positions, emissions mix and CII distribution."""
    vessels = [v.to_dict() for v in db.query(Vessel).all()]
    routes = [r.to_dict() for r in db.query(Route).all()]
    ports = [p.to_dict() for p in db.query(Port).all()]

    distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "E": 0}
    fuel_mix: dict[str, float] = {}
    emissions_by_fuel: dict[str, dict] = {}

    total_fuel_t = 0.0
    total_co2_t = 0.0
    total_wtw_t = 0.0
    total_cost = 0.0
    vessel_cards = []

    for vessel in vessels:
        distance = float(vessel["annual_distance_nm"])
        hours = distance / max(float(vessel["speed_service_kn"]), 1e-6)
        state, _ = compute_propulsion(vessel, vessel["speed_service_kn"], 90.0, REFERENCE_WEATHER)
        energy_mj = state.total_power_kw * hours * 3.6

        fuel_id = vessel["current_fuel"]
        emissions = compute_emissions(energy_mj, fuel_id)
        cii = calculate_cii(vessel["ship_type"], vessel["dwt"], distance,
                            {fuel_id: emissions.fuel_mass_t}, year)

        distribution[cii.rating] += 1
        fuel_mix[fuel_id] = fuel_mix.get(fuel_id, 0.0) + emissions.fuel_mass_t

        bucket = emissions_by_fuel.setdefault(fuel_id, {
            "fuel_id": fuel_id, "fuel_name": emissions.fuel_name,
            "color": get_fuel(fuel_id)["color"],
            "fuel_tonnes": 0.0, "ghg_ttw_t": 0.0, "ghg_wtt_t": 0.0, "ghg_wtw_t": 0.0,
        })
        bucket["fuel_tonnes"] += emissions.fuel_mass_t
        bucket["ghg_ttw_t"] += emissions.ghg_ttw_t
        bucket["ghg_wtt_t"] += emissions.ghg_wtt_t
        bucket["ghg_wtw_t"] += emissions.ghg_wtw_t

        total_fuel_t += emissions.fuel_mass_t
        total_co2_t += emissions.co2_ttw_t
        total_wtw_t += emissions.ghg_wtw_t
        total_cost += emissions.fuel_cost_usd

        # Position each vessel along a route so the map is populated on load.
        route = routes[hash(vessel["id"]) % len(routes)] if routes else None
        position = None
        if route and route["waypoints"]:
            idx = (hash(vessel["id"]) // 7) % len(route["waypoints"])
            waypoint = route["waypoints"][idx]
            position = {"lat": waypoint["lat"], "lon": waypoint["lon"],
                        "route_id": route["id"], "route_name": route["name"],
                        "near": waypoint.get("name", "")}

        vessel_cards.append({
            "id": vessel["id"], "name": vessel["name"], "ship_type": vessel["ship_type"],
            "dwt": vessel["dwt"], "current_fuel": fuel_id,
            "speed_service_kn": vessel["speed_service_kn"],
            "shore_power_capable": vessel["shore_power_capable"],
            "built_year": vessel["built_year"],
            "rating": cii.rating,
            "attained_cii": round(cii.attained_cii, 4),
            "required_cii": round(cii.required_cii, 4),
            "margin_pct": round(cii.margin_to_c_boundary_pct, 2),
            "annual_fuel_tonnes": round(emissions.fuel_mass_t, 1),
            "annual_co2_t": round(emissions.co2_ttw_t, 1),
            "annual_cost_usd": round(emissions.fuel_cost_usd, 0),
            "position": position,
        })

    for bucket in emissions_by_fuel.values():
        for key in ("fuel_tonnes", "ghg_ttw_t", "ghg_wtt_t", "ghg_wtw_t"):
            bucket[key] = round(bucket[key], 2)

    # Savings realised by completed optimisation runs in this session.
    completed = [t for t in registry.list_tasks(100) if t["status"] == "completed"]
    realised_saving = 0.0
    realised_ghg = 0.0
    for task in completed:
        full = registry.get(task["task_id"])
        if full and full.get("result"):
            summary = full["result"].get("front_summary", {})
            realised_saving += summary.get("cost_saving_usd", 0.0) or 0.0
            realised_ghg += summary.get("ghg_saving_t", 0.0) or 0.0

    history = db.query(OptimizationResult).order_by(
        OptimizationResult.created_at.desc()).limit(10).all()

    return {
        "year": year,
        "reduction_factor_z_pct": reduction_factor(year),
        "kpis": {
            "fleet_size": len(vessels),
            "total_dwt": sum(v["dwt"] for v in vessels),
            "annual_fuel_tonnes": round(total_fuel_t, 1),
            "annual_co2_tonnes": round(total_co2_t, 1),
            "annual_ghg_wtw_tonnes": round(total_wtw_t, 1),
            "annual_fuel_cost_usd": round(total_cost, 0),
            "wtt_share_pct": round((total_wtw_t - total_co2_t) / max(total_wtw_t, 1e-9) * 100.0, 1),
            "compliant_vessels": sum(distribution[r] for r in ("A", "B", "C")),
            "at_risk_vessels": distribution["D"] + distribution["E"],
            "optimizations_run": len(completed),
            "realised_cost_saving_usd": round(realised_saving, 0),
            "realised_ghg_saving_t": round(realised_ghg, 1),
        },
        "cii_distribution": distribution,
        "rating_labels": rating_labels(),
        "vessels": vessel_cards,
        "emissions_by_fuel": list(emissions_by_fuel.values()),
        "routes": routes,
        "ports": ports,
        "recent_optimizations": [h.to_dict() for h in history],
        "active_tasks": [t for t in registry.list_tasks(10) if t["status"] == "running"],
    }


@router.get("/map")
def map_data(month: int = 7, db: Session = Depends(get_db)):
    """Routes with their weather overlay, plus ports, for the fleet map."""
    routes = [r.to_dict() for r in db.query(Route).all()]
    for route in routes:
        route["weather"] = generate_route_weather(route, month=month)
        route["max_wave_height_m"] = max((w["wave_height_m"] for w in route["weather"]), default=0.0)
    return {
        "month": month,
        "routes": routes,
        "ports": [p.to_dict() for p in db.query(Port).all()],
    }


@router.get("/formulas")
def formulas():
    """The mathematics behind each page, for the Technical Details panels."""
    return {
        "prediction": [
            {"name": "Model output", "latex": r"\hat{y}_t = f_\theta(X_{1:t}, S, W)",
             "description": "BiLSTM with time-aware self-attention over speed, draft, power and weather."},
            {"name": "Physics-informed loss", "latex": r"\mathcal{L} = \mathcal{L}_{data} + \lambda_{phys}\mathcal{L}_{phys} + \lambda_{reg}\|\theta\|^2",
             "description": "Data fit plus penalties for violating energy conservation and cubic speed scaling."},
            {"name": "Predictive uncertainty", "latex": r"\sigma^2_{total} = \sigma^2_{epistemic} + \sigma^2_{aleatoric}",
             "description": "Epistemic from Monte Carlo Dropout, aleatoric from the learned variance head."},
        ],
        "physics": [
            {"name": "Total resistance", "latex": r"R_{total} = R_{calm} + R_{wind} + R_{wave}",
             "description": "Calm-water resistance from a simplified Holtrop-Mennen decomposition."},
            {"name": "Frictional resistance", "latex": r"R_F = \tfrac{1}{2}\rho V^2 S \cdot C_F (1+k),\quad C_F = \frac{0.075}{(\log_{10}Re - 2)^2}",
             "description": "ITTC-1957 correlation line scaled by a hull form factor."},
            {"name": "Shaft power", "latex": r"P_{shaft} = \frac{R_{total} \cdot V}{\eta_D}(1 + SM)",
             "description": "Quasi-propulsive efficiency and a 15% sea margin."},
            {"name": "Voyage energy", "latex": r"E_{prop} = \int_0^T P_{total}(t)\,dt",
             "description": "Trapezoidal integration over voyage legs."},
        ],
        "optimization": [
            {"name": "QUBO", "latex": r"\min_{x \in \{0,1\}^n} x^\top Q x",
             "description": "Discrete fleet assignment, fuel selection and shore power."},
            {"name": "Trotter coupling", "latex": r"J_\perp = -\frac{P}{2\beta}\ln\left(\tanh\frac{\beta\Gamma}{P}\right)",
             "description": "Path-integral coupling between replicas; weak at high transverse field, stiff as it decays."},
            {"name": "QPSO update", "latex": r"x_i(t+1) = p_i \pm \alpha\,|m_{best} - x_i|\ln(1/u)",
             "description": "Quantum delta-well sampling; no velocity term, so the swarm cannot be trapped."},
            {"name": "Local attractor", "latex": r"p_i = \varphi\, p_{best,i} + (1-\varphi)\, g_{best}",
             "description": "Stochastic blend of personal and global best."},
            {"name": "Scalarised objective", "latex": r"J(w) = \sum_k w_k \hat{f}_k",
             "description": "Sweeping w traces the Pareto front."},
        ],
        "compliance": [
            {"name": "Attained AER", "latex": r"AER = \frac{CO_2}{DWT \times D}",
             "description": "Grams of CO2 per tonne-nautical-mile."},
            {"name": "Reference line", "latex": r"CII_{ref} = a \cdot Capacity^{-c}",
             "description": "Per ship type, from MEPC.353(78)."},
            {"name": "Required CII", "latex": r"CII_{required} = CII_{ref}\,(1 - Z/100)",
             "description": "Z tightens annually toward the 2030 target."},
            {"name": "Compliance constraint", "latex": r"P(CII > CII_{limit}) \leq \varepsilon",
             "description": "Enforced inside the optimiser, not checked afterwards."},
        ],
        "emissions": [
            {"name": "Fuel mass", "latex": r"m_f = \frac{E_{prop}}{LHV_f \cdot \eta_f}",
             "description": "Energy-based conversion; mass differs sharply between fuels."},
            {"name": "Well-to-Wake", "latex": r"GHG_{WtW} = GHG_{WtT} + GHG_{TtW}",
             "description": "Upstream production plus combustion."},
            {"name": "Carbon intensity", "latex": r"CI_{WtW} = \frac{GHG_{WtW}}{m_f \cdot LHV_f}",
             "description": "gCO2e per MJ, the only fair basis for comparing fuels."},
            {"name": "Risk-adjusted fuel", "latex": r"F_{risk} = \mathbb{E}[F] + \lambda\,\sigma(F)",
             "description": "Penalises routes whose fuel burn is volatile under weather uncertainty."},
        ],
    }
