"""Multi-objective evaluation for a vessel-route-fuel-speed decision.

Five objectives, all normalised so weights are comparable:

    f1  Fuel cost          USD
    f2  GHG (Well-to-Wake) tonnes CO2e
    f3  Delay              hours outside the contractual ETA window
    f4  Compliance risk    P(CII exceeds the C boundary)
    f5  Operational risk   uncertainty-adjusted exposure, E[F] + lambda*sigma(F)

The scalarised objective the solvers minimise is

    J(w) = sum_k w_k * fhat_k

with fhat_k the min-max normalised objective. Sweeping w traces the Pareto
front; no single w is "correct", which is the whole argument for returning a
front instead of a number.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict

import numpy as np

from ..compliance.cii_calculator import calculate_cii
from ..emissions.wtw_calculator import compute_emissions
from ..physics.propulsion import integrate_voyage_energy


@dataclass
class ObjectiveVector:
    """Raw (un-normalised) objective values for one candidate solution."""

    fuel_cost_usd: float
    ghg_wtw_t: float
    ghg_ttw_t: float
    co2_ttw_t: float
    delay_hours: float
    compliance_risk: float
    risk_adjusted_fuel_t: float
    fuel_mass_t: float
    duration_hours: float
    energy_mj: float
    cii_attained: float
    cii_rating: str
    cii_compliant: bool

    def to_dict(self) -> dict:
        out = asdict(self)
        for k, v in out.items():
            if isinstance(v, float):
                out[k] = round(v, 6)
        return out

    def as_array(self) -> np.ndarray:
        """The five objectives, in canonical order, all minimised."""
        return np.array([
            self.fuel_cost_usd,
            self.ghg_wtw_t,
            self.delay_hours,
            self.compliance_risk,
            self.risk_adjusted_fuel_t,
        ])


OBJECTIVE_NAMES = ["fuel_cost", "ghg_wtw", "delay", "compliance_risk", "risk_adjusted_fuel"]
OBJECTIVE_LABELS = {
    "fuel_cost": "Fuel Cost (USD)",
    "ghg_wtw": "GHG Well-to-Wake (t CO2e)",
    "delay": "Schedule Delay (h)",
    "compliance_risk": "CII Compliance Risk",
    "risk_adjusted_fuel": "Risk-Adjusted Fuel (t)",
}


def build_legs(route: dict, speeds_kn: np.ndarray, weather_by_leg: list[dict]) -> list[dict]:
    """Assemble per-leg inputs from a route, a speed vector and a weather field."""
    waypoints = route["waypoints"]
    legs = []
    for i in range(len(waypoints) - 1):
        a, b = waypoints[i], waypoints[i + 1]
        distance = _haversine_nm(a["lat"], a["lon"], b["lat"], b["lon"])
        heading = _bearing_deg(a["lat"], a["lon"], b["lat"], b["lon"])
        legs.append({
            "distance_nm": distance,
            "speed_kn": float(speeds_kn[i]) if i < len(speeds_kn) else float(speeds_kn[-1]),
            "heading_deg": heading,
            "weather": weather_by_leg[i] if i < len(weather_by_leg) else {},
            "from": a, "to": b,
        })
    return legs


def evaluate_solution(vessel: dict, route: dict, fuel_id: str, speeds_kn: np.ndarray,
                      weather_by_leg: list[dict], year: int = 2026,
                      uncertainty_lambda: float = 1.0,
                      shore_power: bool = False,
                      shore_power_result: dict | None = None) -> tuple[ObjectiveVector, dict]:
    """Score one complete candidate decision. Returns objectives plus full detail."""
    legs = build_legs(route, speeds_kn, weather_by_leg)
    voyage = integrate_voyage_energy(vessel, legs)

    energy_mj = voyage["total_energy_mj"]
    emissions = compute_emissions(energy_mj, fuel_id)

    fuel_cost = emissions.fuel_cost_usd
    ghg_wtw = emissions.ghg_wtw_t
    ghg_ttw = emissions.ghg_ttw_t
    co2_ttw = emissions.co2_ttw_t

    # Shore power displaces at-berth auxiliary burn from the vessel's account.
    if shore_power and shore_power_result and shore_power_result.get("feasible"):
        fuel_cost += shore_power_result["shore_power_option"]["cost_usd"]
        ghg_wtw += shore_power_result["shore_power_option"]["ghg_wtw_t"]
    elif shore_power_result:
        fuel_cost += shore_power_result["auxiliary_option"]["cost_usd"]
        ghg_wtw += shore_power_result["auxiliary_option"]["ghg_wtw_t"]
        co2_ttw += shore_power_result["auxiliary_option"]["co2_ttw_t"]
        ghg_ttw += shore_power_result["auxiliary_option"]["ghg_ttw_t"]

    # --- schedule delay against the contractual window ---
    duration = voyage["total_duration_hours"]
    window = route.get("eta_window_hours", [0.0, 1e9])
    if duration > window[1]:
        delay = duration - window[1]
    elif duration < window[0]:
        # Arriving early also costs: demurrage, waiting at anchor burning aux.
        delay = (window[0] - duration) * 0.25
    else:
        delay = 0.0

    # --- CII position and the probability of breaching it ---
    cii = calculate_cii(vessel["ship_type"], vessel["dwt"], voyage["total_distance_nm"],
                        {fuel_id: emissions.fuel_mass_t}, year)

    # Weather-driven fuel uncertainty propagates into CII uncertainty.
    sigma_fraction = _weather_uncertainty(weather_by_leg)
    sigma_fuel_t = emissions.fuel_mass_t * sigma_fraction
    risk_adjusted_fuel = emissions.fuel_mass_t + uncertainty_lambda * sigma_fuel_t

    compliance_risk = _exceedance_probability(
        cii.attained_cii, cii.boundaries["C_upper"], sigma_fraction
    )

    objectives = ObjectiveVector(
        fuel_cost_usd=fuel_cost,
        ghg_wtw_t=ghg_wtw,
        ghg_ttw_t=ghg_ttw,
        co2_ttw_t=co2_ttw,
        delay_hours=delay,
        compliance_risk=compliance_risk,
        risk_adjusted_fuel_t=risk_adjusted_fuel,
        fuel_mass_t=emissions.fuel_mass_t,
        duration_hours=duration,
        energy_mj=energy_mj,
        cii_attained=cii.attained_cii,
        cii_rating=cii.rating,
        cii_compliant=cii.is_compliant,
    )

    detail = {
        "voyage": voyage,
        "emissions": emissions.to_dict(),
        "cii": cii.to_dict(),
        "sigma_fuel_t": sigma_fuel_t,
        "sigma_fraction": sigma_fraction,
        "speed_profile": [
            {
                "leg": i,
                "from": leg["from"]["name"],
                "to": leg["to"]["name"],
                "distance_nm": round(leg["distance_nm"], 2),
                "speed_kn": round(leg["speed_kn"], 3),
                "heading_deg": round(leg["heading_deg"], 1),
                "duration_hours": round(voyage["legs"][i]["duration_hours"], 3),
                "shaft_power_kw": round(voyage["legs"][i]["shaft_power_kw"], 1),
                "engine_load_pct": round(voyage["legs"][i]["engine_load_pct"], 1),
                "energy_mj": round(voyage["legs"][i]["energy_mj"], 1),
                "resistance": voyage["legs"][i]["resistance"],
                "weather": leg["weather"],
            }
            for i, leg in enumerate(legs)
        ],
    }
    return objectives, detail


def _weather_uncertainty(weather_by_leg: list[dict]) -> float:
    """Fractional 1-sigma on fuel, driven by how rough the forecast is.

    Calm water is predictable; a 4 m sea is not. This is what makes the
    risk-adjusted objective differ from the deterministic one -- a route through
    a storm has a fatter tail even when its mean looks acceptable.
    """
    if not weather_by_leg:
        return 0.05
    waves = [float(w.get("wave_height_m", 1.0)) for w in weather_by_leg]
    winds = [float(w.get("wind_speed_kn", 8.0)) for w in weather_by_leg]
    mean_wave = float(np.mean(waves))
    mean_wind = float(np.mean(winds))
    wave_spread = float(np.std(waves))
    base = 0.035
    return min(0.40, base + 0.035 * mean_wave + 0.0028 * mean_wind + 0.05 * wave_spread)


def _exceedance_probability(attained: float, limit: float, sigma_fraction: float) -> float:
    """P(CII > limit) under a lognormal-ish fuel uncertainty, via the normal CDF."""
    if limit <= 0:
        return 1.0
    sigma = max(attained * sigma_fraction, 1e-9)
    z = (limit - attained) / sigma
    # P(X > limit) = 1 - Phi(z)
    return float(0.5 * math.erfc(z / math.sqrt(2.0)))


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_nm = 3440.065
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r_nm * math.asin(math.sqrt(min(1.0, a)))


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def normalize_objectives(matrix: np.ndarray) -> np.ndarray:
    """Min-max normalise each objective column onto [0,1]."""
    lo = matrix.min(axis=0)
    hi = matrix.max(axis=0)
    span = np.where(np.abs(hi - lo) < 1e-12, 1.0, hi - lo)
    return (matrix - lo) / span


def generate_weight_vectors(n_objectives: int = 5, n_solutions: int = 20,
                            seed: int | None = 42) -> np.ndarray:
    """Weight vectors on the unit simplex, spanning corners and interior.

    Includes every single-objective corner (so the front reaches its true
    extremes), the uniform centroid, and a Dirichlet-sampled interior for the
    trade-off region in between.
    """
    rng = np.random.default_rng(seed)
    vectors = [np.eye(n_objectives)[i] for i in range(n_objectives)]
    vectors.append(np.full(n_objectives, 1.0 / n_objectives))

    # Pairwise balances surface the two-objective trade-offs operators ask about.
    for i in range(n_objectives):
        for j in range(i + 1, n_objectives):
            v = np.zeros(n_objectives)
            v[i] = v[j] = 0.5
            vectors.append(v)

    while len(vectors) < n_solutions:
        vectors.append(rng.dirichlet(np.ones(n_objectives) * 0.8))

    return np.array(vectors[:max(n_solutions, n_objectives + 1)])
