"""Synthetic but physically coherent weather fields along a route.

Real deployment would pull NOAA GFS or Copernicus CMEMS grids. For the demo we
generate fields with the right *structure*: spatially correlated (adjacent legs
see similar conditions, because weather systems are hundreds of nautical miles
across), seasonally modulated by the monsoon, and rougher in open ocean than in
coastal or strait waters. That structure is what the optimizer actually reacts
to, so the routing decisions it makes are the same ones real forecasts drive.
"""

from __future__ import annotations

import hashlib
import math

import numpy as np

# Monsoon modulation for the North Indian Ocean, by month index (1-12).
# Southwest monsoon (Jun-Sep) is the dominant sea-state driver on these routes.
MONSOON_WAVE_FACTOR = {
    1: 0.75, 2: 0.65, 3: 0.60, 4: 0.65, 5: 0.90, 6: 1.55,
    7: 1.80, 8: 1.70, 9: 1.35, 10: 0.95, 11: 0.90, 12: 0.85,
}
MONSOON_WIND_DIR = {
    1: 45.0, 2: 45.0, 3: 60.0, 4: 90.0, 5: 180.0, 6: 225.0,
    7: 240.0, 8: 240.0, 9: 225.0, 10: 90.0, 11: 45.0, 12: 45.0,
}


def _seed_from(route_id: str, scenario: str) -> int:
    digest = hashlib.sha256(f"{route_id}:{scenario}".encode()).hexdigest()
    return int(digest[:8], 16)


def generate_route_weather(route: dict, month: int = 7, scenario: str = "forecast",
                           severity: float = 1.0) -> list[dict]:
    """One weather state per leg, spatially correlated along the track.

    Parameters
    ----------
    month : 1-12, drives monsoon intensity and prevailing wind direction.
    scenario : names the realisation. Different scenarios give different draws
        from the same climatology -- used for ensemble/uncertainty runs.
    severity : multiplier on sea state. 1.0 is climatological; the UI exposes
        this so a fleet manager can stress-test a route.
    """
    waypoints = route["waypoints"]
    n_legs = max(1, len(waypoints) - 1)
    rng = np.random.default_rng(_seed_from(route["id"], scenario))

    wave_factor = MONSOON_WAVE_FACTOR.get(month, 1.0) * severity
    prevailing_dir = MONSOON_WIND_DIR.get(month, 90.0)

    # An AR(1) walk gives spatial correlation: neighbouring legs share weather.
    rho = 0.72
    wave_innovations = rng.normal(0.0, 1.0, n_legs)
    wind_innovations = rng.normal(0.0, 1.0, n_legs)
    wave_walk = np.zeros(n_legs)
    wind_walk = np.zeros(n_legs)
    for i in range(1, n_legs):
        wave_walk[i] = rho * wave_walk[i - 1] + math.sqrt(1 - rho ** 2) * wave_innovations[i]
        wind_walk[i] = rho * wind_walk[i - 1] + math.sqrt(1 - rho ** 2) * wind_innovations[i]

    legs: list[dict] = []
    for i in range(n_legs):
        a, b = waypoints[i], waypoints[i + 1]
        mid_lat = (a["lat"] + b["lat"]) / 2.0
        mid_lon = (a["lon"] + b["lon"]) / 2.0

        # Open ocean is rougher than coastal water and far rougher than straits.
        exposure = _exposure_factor(mid_lat, mid_lon)

        base_wave = 1.35 * wave_factor * exposure
        wave_height = float(np.clip(base_wave + 0.55 * wave_walk[i] * wave_factor, 0.3, 7.5))

        base_wind = 11.0 * math.sqrt(wave_factor) * exposure
        wind_speed = float(np.clip(base_wind + 3.6 * wind_walk[i], 2.0, 48.0))

        # Wave period follows fetch-limited growth: bigger seas run longer.
        wave_period = float(np.clip(3.5 + 2.6 * math.sqrt(wave_height) + rng.normal(0, 0.4), 3.0, 16.0))

        wind_direction = float((prevailing_dir + rng.normal(0, 28.0)) % 360.0)
        # Seas run broadly with the wind, lagging it slightly.
        wave_direction = float((wind_direction + rng.normal(0, 18.0)) % 360.0)

        current_speed = float(np.clip(abs(rng.normal(0.55, 0.42)), 0.0, 2.4))
        current_direction = float((prevailing_dir + 90.0 + rng.normal(0, 55.0)) % 360.0)

        legs.append({
            "leg_index": i,
            "lat": round(mid_lat, 4),
            "lon": round(mid_lon, 4),
            "wind_speed_kn": round(wind_speed, 2),
            "wind_direction_deg": round(wind_direction, 1),
            "wave_height_m": round(wave_height, 2),
            "wave_period_s": round(wave_period, 2),
            "wave_direction_deg": round(wave_direction, 1),
            "current_speed_kn": round(current_speed, 2),
            "current_direction_deg": round(current_direction, 1),
            "sea_state": _sea_state(wave_height),
            "exposure": round(exposure, 2),
        })
    return legs


def _exposure_factor(lat: float, lon: float) -> float:
    """How exposed a position is to open-ocean swell."""
    # Malacca Strait and the Singapore approaches are sheltered and shallow.
    if 0.0 < lat < 6.5 and 97.0 < lon < 105.0:
        return 0.45
    # Palk Bay / Gulf of Mannar, sheltered by Sri Lanka and the Indian coast.
    if 5.5 < lat < 10.5 and 78.0 < lon < 82.0:
        return 0.60
    # Persian Gulf approaches and Gulf of Oman.
    if 22.0 < lat < 27.0 and 55.0 < lon < 62.0:
        return 0.70
    # Open Arabian Sea and Bay of Bengal.
    if -5.0 < lat < 22.0 and 60.0 < lon < 95.0:
        return 1.15
    # North Pacific approaches to Japan: the roughest water on these routes.
    if 25.0 < lat < 40.0 and 120.0 < lon < 145.0:
        return 1.30
    return 1.0


def _sea_state(wave_height_m: float) -> str:
    """WMO sea state description."""
    if wave_height_m < 0.5: return "Calm"
    if wave_height_m < 1.25: return "Slight"
    if wave_height_m < 2.5: return "Moderate"
    if wave_height_m < 4.0: return "Rough"
    if wave_height_m < 6.0: return "Very rough"
    return "High"


def generate_forecast_grid(route: dict, days: int = 7, month: int = 7) -> list[dict]:
    """A rolling multi-day forecast, with skill decaying as lead time grows.

    Forecast uncertainty roughly doubles between day 1 and day 7, which is what
    justifies the rolling-horizon re-optimisation: today's plan for day 6 is
    worth revisiting when day 6 becomes day 1.
    """
    grid = []
    for day in range(days):
        severity = 1.0 + 0.06 * day  # forecast spread widens with lead time
        legs = generate_route_weather(route, month=month,
                                      scenario=f"day{day}", severity=severity)
        grid.append({
            "day": day,
            "forecast_skill": round(max(0.35, 1.0 - 0.09 * day), 3),
            "legs": legs,
        })
    return grid
