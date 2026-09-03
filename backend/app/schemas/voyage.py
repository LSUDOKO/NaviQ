from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Waypoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    name: str = ""


class RouteOut(BaseModel):
    id: str
    name: str
    origin_port: str
    destination_port: str
    distance_nm: float
    cargo_demand_t: float
    revenue_usd: float
    eta_window_hours: list[float]
    waypoints: list[Waypoint]


class VoyageCreate(BaseModel):
    vessel_id: str
    route_id: str
    fuel_id: str = "VLSFO"
    departure: datetime | None = None
    speeds_kn: list[float] | None = Field(
        None, description="Per-leg speeds. Defaults to the vessel's service speed."
    )


class VoyageOut(BaseModel):
    id: str
    vessel_id: str
    route_id: str
    fuel_id: str
    departure: datetime | None
    status: str
    distance_nm: float
    duration_hours: float
    fuel_tonnes: float
    fuel_cost_usd: float
    co2_ttw_t: float
    ghg_wtw_t: float
    cii_attained: float
    cii_rating: str
    speed_profile: list = []
    created_at: datetime | None = None
