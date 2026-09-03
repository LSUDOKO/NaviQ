"""Hydrodynamic resistance decomposition for a vessel on a voyage leg.

Total resistance is split into physically separable components so the UI can
show operators *why* a leg is expensive, not just how much it costs:

    R_total = R_calm + R_wind + R_wave

with current handled separately as a modifier on speed-through-water rather
than as a force (a following current does not push the hull, it changes the
water the hull moves through).

The calm-water term uses a simplified Holtrop-Mennen decomposition:
frictional resistance from the ITTC-1957 correlation line plus a form factor,
and a residuary term that captures wave-making and grows sharply with Froude
number. Full Holtrop-Mennen needs hull-form coefficients no operator has to
hand; this form needs only the principal particulars in an AIS/registry record.

References
----------
Holtrop, J. & Mennen, G.G.J. (1982) "An approximate power prediction method",
    International Shipbuilding Progress 29(335).
ITTC (1957) Skin friction correlation line.
ITTC (2014) Recommended Procedures 7.5-02-07-02.2, added resistance in waves.
Kitamura et al. (2017) added wave resistance regression for full-form hulls.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict

# Physical constants (seawater at 15 degC, standard atmosphere)
RHO_SEAWATER = 1025.0   # kg/m3
RHO_AIR = 1.225         # kg/m3
NU_SEAWATER = 1.1883e-6  # m2/s kinematic viscosity
GRAVITY = 9.80665       # m/s2
KNOTS_TO_MS = 0.514444


@dataclass
class ResistanceBreakdown:
    """Resistance components in kilonewtons, plus the diagnostics behind them."""

    r_calm_kn: float
    r_wind_kn: float
    r_wave_kn: float
    r_total_kn: float
    # Sub-components of calm water resistance
    r_friction_kn: float
    r_residuary_kn: float
    # Diagnostics
    froude_number: float
    reynolds_number: float
    speed_through_water_kn: float
    current_effect_kn: float

    def to_dict(self) -> dict:
        return {k: round(v, 4) for k, v in asdict(self).items()}


def froude_number(speed_ms: float, length_m: float) -> float:
    """Fn = V / sqrt(g*L). Governs wave-making resistance."""
    if length_m <= 0:
        return 0.0
    return speed_ms / math.sqrt(GRAVITY * length_m)


def reynolds_number(speed_ms: float, length_m: float) -> float:
    """Re = V*L/nu. Governs frictional resistance."""
    if speed_ms <= 0:
        return 0.0
    return speed_ms * length_m / NU_SEAWATER


def frictional_resistance(speed_ms: float, length_m: float, wetted_surface_m2: float,
                          block_coefficient: float, beam_m: float, draft_m: float) -> float:
    """ITTC-1957 friction line scaled by a Holtrop form factor. Returns kN.

        C_F = 0.075 / (log10(Re) - 2)^2
        R_F = 0.5 * rho * V^2 * S * C_F * (1 + k)

    The form factor (1+k) accounts for the pressure drag a real 3D hull adds
    over an equivalent flat plate; it grows with fullness (Cb) and stubbiness.
    """
    if speed_ms <= 0:
        return 0.0

    re = reynolds_number(speed_ms, length_m)
    if re <= 0:
        return 0.0
    c_f = 0.075 / (math.log10(re) - 2.0) ** 2

    # Holtrop form factor approximation from principal particulars.
    l_over_b = length_m / max(beam_m, 1e-6)
    b_over_t = beam_m / max(draft_m, 1e-6)
    form_factor = 0.93 + 0.487 * block_coefficient * (b_over_t ** 0.5) / max(l_over_b ** 0.5, 1e-6)
    form_factor = max(1.10, min(form_factor, 1.45))

    r_f = 0.5 * RHO_SEAWATER * speed_ms ** 2 * wetted_surface_m2 * c_f * form_factor
    return r_f / 1000.0


def residuary_resistance(speed_ms: float, length_m: float, beam_m: float, draft_m: float,
                         block_coefficient: float, displacement_t: float) -> float:
    """Wave-making and pressure resistance. Returns kN.

    Residuary resistance is negligible at low Froude number and rises steeply
    once the hull starts generating its own wave system. The exponential in Fn
    reproduces the characteristic "wall" that makes slow steaming so effective:
    dropping 2 knots off a 14-knot service speed cuts this term by roughly half.
    """
    if speed_ms <= 0 or displacement_t <= 0:
        return 0.0

    fn = froude_number(speed_ms, length_m)
    # Residuary coefficient rises exponentially with Fn, modulated by fullness.
    c_r = 1.05e-3 * math.exp(9.4 * max(fn - 0.12, 0.0)) * (0.72 + 0.78 * block_coefficient)
    # Slenderness penalty: short, wide hulls make more waves.
    slenderness = length_m / max((displacement_t / RHO_SEAWATER * 1000.0) ** (1.0 / 3.0), 1e-6)
    c_r *= max(0.55, min(2.2, 7.2 / max(slenderness, 1e-6)))

    reference_area = beam_m * draft_m
    r_r = 0.5 * RHO_SEAWATER * speed_ms ** 2 * reference_area * c_r
    return r_r / 1000.0


def wind_resistance(wind_speed_kn: float, wind_direction_deg: float, heading_deg: float,
                    vessel_speed_kn: float, frontal_area_m2: float) -> float:
    """Added resistance from apparent wind on the above-water body. Returns kN.

        R_wind = 0.5 * rho_air * C_x(psi) * A_frontal * V_apparent^2

    Uses apparent wind (the vector sum of true wind and the vessel's own motion)
    and a direction-dependent drag coefficient. A following wind yields negative
    resistance -- genuine thrust -- which is why the sign is preserved here.
    """
    if frontal_area_m2 <= 0:
        return 0.0

    # Relative angle between where the wind comes FROM and where the ship points.
    relative_deg = (wind_direction_deg - heading_deg + 180.0) % 360.0 - 180.0
    relative_rad = math.radians(relative_deg)

    v_wind = wind_speed_kn * KNOTS_TO_MS
    v_ship = vessel_speed_kn * KNOTS_TO_MS

    # Apparent wind components in the ship reference frame.
    v_app_x = v_wind * math.cos(relative_rad) + v_ship  # head-on positive
    v_app_y = v_wind * math.sin(relative_rad)
    v_app = math.hypot(v_app_x, v_app_y)
    if v_app <= 0:
        return 0.0

    apparent_angle = math.atan2(v_app_y, v_app_x)
    # Longitudinal wind drag coefficient: max head-on, negative (thrust) astern.
    c_x = 0.7 * math.cos(apparent_angle) + 0.15 * math.cos(2.0 * apparent_angle)

    r_wind = 0.5 * RHO_AIR * c_x * frontal_area_m2 * v_app ** 2
    return r_wind / 1000.0


def wave_resistance(wave_height_m: float, wave_period_s: float, wave_direction_deg: float,
                    heading_deg: float, length_m: float, beam_m: float,
                    speed_ms: float, block_coefficient: float) -> float:
    """Added resistance in waves (ITTC-style short-wave + motion-induced). Returns kN.

        R_wave ~ rho * g * H_s^2 * B^2 / L * f(encounter) * f(heading)

    Scales with the square of significant wave height -- a 3 m sea is nine times
    the penalty of a 1 m sea, not three. Head seas cost the most; following seas
    are largely benign, captured by the heading factor.
    """
    if wave_height_m <= 0 or length_m <= 0:
        return 0.0

    relative_deg = (wave_direction_deg - heading_deg + 180.0) % 360.0 - 180.0
    relative_rad = math.radians(relative_deg)

    # Head seas (relative ~ 0) worst; following seas (relative ~ 180) mildest.
    heading_factor = 0.50 + 0.50 * math.cos(relative_rad)
    heading_factor = max(0.10, heading_factor)

    # Encounter frequency amplification: resonance when wave period is near the
    # vessel's natural pitch period, approximated from waterline length.
    natural_period = 2.0 * math.pi * math.sqrt(max(length_m, 1.0) / (2.0 * GRAVITY))
    period = max(wave_period_s, 1.0)
    detuning = abs(period - natural_period) / natural_period
    resonance_factor = 1.0 + 0.85 * math.exp(-4.0 * detuning ** 2)

    # Speed dependence: added resistance grows with forward speed into the sea.
    fn = froude_number(speed_ms, length_m)
    speed_factor = 0.35 + 2.6 * fn

    base = RHO_SEAWATER * GRAVITY * (wave_height_m ** 2) * (beam_m ** 2) / max(length_m, 1.0)
    r_wave = 0.055 * base * heading_factor * resonance_factor * speed_factor * (0.7 + 0.5 * block_coefficient)
    return r_wave / 1000.0


def effective_speed_through_water(speed_over_ground_kn: float, current_speed_kn: float,
                                  current_direction_deg: float, heading_deg: float) -> float:
    """Speed through water given a set and drift.

    The hull only ever feels speed *through water*. A 1.5 kn following current
    means a ship making 14 kn over ground is only pushing 12.5 kn of water --
    and pays the resistance of 12.5 kn, which is the whole point of routing
    with the current.
    """
    relative_deg = (current_direction_deg - heading_deg + 180.0) % 360.0 - 180.0
    along_track = current_speed_kn * math.cos(math.radians(relative_deg))
    # Current flowing TOWARD the heading (along_track negative here) helps.
    return max(0.5, speed_over_ground_kn + along_track)


def compute_resistance(vessel: dict, speed_over_ground_kn: float, heading_deg: float,
                       weather: dict) -> ResistanceBreakdown:
    """Full resistance decomposition for one vessel, speed and weather state.

    Parameters
    ----------
    vessel : dict with length_m, beam_m, draft_design_m, block_coefficient,
        wetted_surface_m2, frontal_area_m2, dwt
    speed_over_ground_kn : commanded speed in knots
    heading_deg : course over ground, degrees true
    weather : dict with wind_speed_kn, wind_direction_deg, wave_height_m,
        wave_period_s, wave_direction_deg, current_speed_kn, current_direction_deg
    """
    length = float(vessel["length_m"])
    beam = float(vessel["beam_m"])
    draft = float(vessel["draft_design_m"])
    cb = float(vessel["block_coefficient"])
    wetted = float(vessel["wetted_surface_m2"])
    frontal = float(vessel["frontal_area_m2"])

    # Displacement from principal particulars.
    displacement_t = length * beam * draft * cb * RHO_SEAWATER / 1000.0

    stw_kn = effective_speed_through_water(
        speed_over_ground_kn,
        float(weather.get("current_speed_kn", 0.0)),
        float(weather.get("current_direction_deg", 0.0)),
        heading_deg,
    )
    stw_ms = stw_kn * KNOTS_TO_MS

    r_friction = frictional_resistance(stw_ms, length, wetted, cb, beam, draft)
    r_residuary = residuary_resistance(stw_ms, length, beam, draft, cb, displacement_t)
    r_calm = r_friction + r_residuary

    r_wind = wind_resistance(
        float(weather.get("wind_speed_kn", 0.0)),
        float(weather.get("wind_direction_deg", 0.0)),
        heading_deg, stw_kn, frontal,
    )
    r_wave = wave_resistance(
        float(weather.get("wave_height_m", 0.0)),
        float(weather.get("wave_period_s", 8.0)),
        float(weather.get("wave_direction_deg", 0.0)),
        heading_deg, length, beam, stw_ms, cb,
    )

    # Net resistance can never be negative: a ship in a following gale still
    # has to overcome hull friction.
    r_total = max(r_calm * 0.35, r_calm + r_wind + r_wave)

    # How many kN the current is worth, expressed as the resistance delta.
    r_calm_sog = (frictional_resistance(speed_over_ground_kn * KNOTS_TO_MS, length, wetted, cb, beam, draft)
                  + residuary_resistance(speed_over_ground_kn * KNOTS_TO_MS, length, beam, draft, cb, displacement_t))
    current_effect = r_calm - r_calm_sog

    return ResistanceBreakdown(
        r_calm_kn=r_calm,
        r_wind_kn=r_wind,
        r_wave_kn=r_wave,
        r_total_kn=r_total,
        r_friction_kn=r_friction,
        r_residuary_kn=r_residuary,
        froude_number=froude_number(stw_ms, length),
        reynolds_number=reynolds_number(stw_ms, length),
        speed_through_water_kn=stw_kn,
        current_effect_kn=current_effect,
    )
