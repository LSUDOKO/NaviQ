"""Propulsive power and voyage energy integration.

Chain from resistance to fuel energy:

    P_effective = R_total * V          (towing power actually delivered to water)
    P_shaft     = P_effective / eta_D  (shaft power after propulsive losses)
    P_total     = P_shaft + P_aux      (plus hotel/auxiliary load)
    E_prop      = integral P_total dt  (trapezoidal over voyage legs)

eta_D is the quasi-propulsive coefficient: the product of hull efficiency,
open-water propeller efficiency and relative rotative efficiency. Sea margin
and engine load-dependent efficiency are applied on top.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

from .resistance import KNOTS_TO_MS, ResistanceBreakdown, compute_resistance

# Fraction added to calm-water power to cover hull/propeller fouling and
# unmodelled sea state. 15% is the ITTC/industry convention for a clean-ish hull.
SEA_MARGIN = 0.15


@dataclass
class PropulsionState:
    """Instantaneous power state on a leg."""

    speed_kn: float
    resistance_kn: float
    effective_power_kw: float
    shaft_power_kw: float
    auxiliary_power_kw: float
    total_power_kw: float
    engine_load_pct: float
    specific_power_kw_per_kn3: float

    def to_dict(self) -> dict:
        return {k: round(v, 4) for k, v in asdict(self).items()}


def engine_load_efficiency(load_fraction: float) -> float:
    """Relative efficiency multiplier vs. the engine's design point.

    Marine two-strokes peak near 75-80% MCR and degrade at both extremes.
    Running very light (deep slow steaming) is thermodynamically poorer per kWh,
    which partially offsets the cubic power saving -- the optimizer needs this
    or it would drive every vessel to its minimum speed.
    """
    if load_fraction <= 0.0:
        return 0.70
    optimal = 0.78
    deviation = abs(load_fraction - optimal)
    return max(0.70, 1.0 - 0.42 * deviation ** 2 - 0.12 * max(0.0, 0.35 - load_fraction))


def compute_propulsion(vessel: dict, speed_kn: float, heading_deg: float,
                       weather: dict) -> tuple[PropulsionState, ResistanceBreakdown]:
    """Shaft and total power required to hold `speed_kn` in the given weather."""
    resistance = compute_resistance(vessel, speed_kn, heading_deg, weather)

    speed_ms = resistance.speed_through_water_kn * KNOTS_TO_MS
    # P = F * V, with resistance in kN and speed in m/s giving kW directly.
    p_effective = resistance.r_total_kn * speed_ms

    eta_d = float(vessel.get("propulsive_efficiency", 0.68))
    p_shaft = p_effective / max(eta_d, 1e-6)
    p_shaft *= (1.0 + SEA_MARGIN)

    p_aux = float(vessel.get("aux_engine_kw", 0.0)) * 0.35  # typical at-sea hotel load
    p_total = p_shaft + p_aux

    mcr = float(vessel.get("main_engine_kw", 1.0))
    load_fraction = p_shaft / max(mcr, 1e-6)

    return (
        PropulsionState(
            speed_kn=speed_kn,
            resistance_kn=resistance.r_total_kn,
            effective_power_kw=p_effective,
            shaft_power_kw=p_shaft,
            auxiliary_power_kw=p_aux,
            total_power_kw=p_total,
            engine_load_pct=load_fraction * 100.0,
            specific_power_kw_per_kn3=p_shaft / max(speed_kn ** 3, 1e-6),
        ),
        resistance,
    )


def integrate_leg_energy(vessel: dict, speed_kn: float, distance_nm: float,
                         heading_deg: float, weather: dict) -> dict:
    """Energy consumed traversing one leg at a constant commanded speed.

    Returns propulsive energy in MJ along with the duration and power state.
    Trapezoidal integration collapses to P*t for a constant-speed leg; the
    voyage-level integral over legs is the trapezoidal sum.
    """
    state, resistance = compute_propulsion(vessel, speed_kn, heading_deg, weather)

    duration_h = distance_nm / max(speed_kn, 1e-6)
    energy_kwh = state.total_power_kw * duration_h
    energy_mj = energy_kwh * 3.6

    return {
        "distance_nm": distance_nm,
        "speed_kn": speed_kn,
        "duration_hours": duration_h,
        "shaft_power_kw": state.shaft_power_kw,
        "total_power_kw": state.total_power_kw,
        "engine_load_pct": state.engine_load_pct,
        "energy_kwh": energy_kwh,
        "energy_mj": energy_mj,
        "resistance": resistance.to_dict(),
        "propulsion": state.to_dict(),
    }


def integrate_voyage_energy(vessel: dict, legs: list[dict]) -> dict:
    """Trapezoidal integration of power over a sequence of legs.

    Each leg dict must carry: distance_nm, speed_kn, heading_deg, weather.
    Returns total energy, duration, and the per-leg detail the UI plots.
    """
    leg_results: list[dict] = []
    total_energy_mj = 0.0
    total_duration_h = 0.0
    total_distance_nm = 0.0

    for leg in legs:
        result = integrate_leg_energy(
            vessel,
            float(leg["speed_kn"]),
            float(leg["distance_nm"]),
            float(leg.get("heading_deg", 0.0)),
            leg.get("weather", {}),
        )
        leg_results.append(result)
        total_energy_mj += result["energy_mj"]
        total_duration_h += result["duration_hours"]
        total_distance_nm += result["distance_nm"]

    avg_speed = total_distance_nm / max(total_duration_h, 1e-6)

    return {
        "legs": leg_results,
        "total_energy_mj": total_energy_mj,
        "total_energy_kwh": total_energy_mj / 3.6,
        "total_duration_hours": total_duration_h,
        "total_distance_nm": total_distance_nm,
        "average_speed_kn": avg_speed,
        "average_power_kw": (total_energy_mj / 3.6) / max(total_duration_h, 1e-6),
    }
