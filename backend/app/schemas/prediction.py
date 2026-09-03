from __future__ import annotations

from pydantic import BaseModel, Field


class WeatherCondition(BaseModel):
    wind_speed_kn: float = Field(10.0, ge=0, le=100)
    wind_direction_deg: float = Field(0.0, ge=0, lt=360)
    wave_height_m: float = Field(1.5, ge=0, le=15)
    wave_period_s: float = Field(8.0, gt=0, le=25)
    wave_direction_deg: float = Field(0.0, ge=0, lt=360)
    current_speed_kn: float = Field(0.5, ge=0, le=6)
    current_direction_deg: float = Field(0.0, ge=0, lt=360)


class PredictionRequest(BaseModel):
    vessel_id: str
    route_id: str | None = Field(None, description="Use a stored route's waypoints.")
    waypoints: list[dict] | None = Field(None, description="Ad-hoc route, if no route_id.")
    fuel_id: str = "VLSFO"
    speed_kn: float | None = Field(None, gt=0, description="Constant speed. Defaults to service speed.")
    speeds_kn: list[float] | None = Field(None, description="Per-leg speeds, overrides speed_kn.")
    weather: WeatherCondition | None = Field(None, description="Uniform weather. Omit to auto-generate.")
    month: int = Field(7, ge=1, le=12, description="Drives the monsoon climatology.")
    mc_samples: int = Field(40, ge=5, le=200, description="Monte Carlo Dropout passes.")


class FuelComparisonRequest(BaseModel):
    vessel_id: str
    route_id: str
    speed_kn: float | None = None
    fuel_ids: list[str] | None = None
    month: int = Field(7, ge=1, le=12)
    year: int = Field(2026, ge=2019, le=2050)
