"""Route and Voyage ORM models."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    origin_port: Mapped[str] = mapped_column(String(16), nullable=False)
    destination_port: Mapped[str] = mapped_column(String(16), nullable=False)
    distance_nm: Mapped[float] = mapped_column(Float, nullable=False)
    cargo_demand_t: Mapped[float] = mapped_column(Float, default=0.0)
    revenue_usd: Mapped[float] = mapped_column(Float, default=0.0)
    eta_window_hours: Mapped[str] = mapped_column(Text, default="[]")
    waypoints: Mapped[str] = mapped_column(Text, default="[]")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name,
            "origin_port": self.origin_port, "destination_port": self.destination_port,
            "distance_nm": self.distance_nm, "cargo_demand_t": self.cargo_demand_t,
            "revenue_usd": self.revenue_usd,
            "eta_window_hours": json.loads(self.eta_window_hours or "[]"),
            "waypoints": json.loads(self.waypoints or "[]"),
        }


class Voyage(Base):
    __tablename__ = "voyages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    vessel_id: Mapped[str] = mapped_column(ForeignKey("vessels.id"), nullable=False)
    route_id: Mapped[str] = mapped_column(ForeignKey("routes.id"), nullable=False)
    fuel_id: Mapped[str] = mapped_column(String(24), default="VLSFO")

    departure: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    status: Mapped[str] = mapped_column(String(24), default="planned")

    distance_nm: Mapped[float] = mapped_column(Float, default=0.0)
    duration_hours: Mapped[float] = mapped_column(Float, default=0.0)
    fuel_tonnes: Mapped[float] = mapped_column(Float, default=0.0)
    fuel_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    co2_ttw_t: Mapped[float] = mapped_column(Float, default=0.0)
    ghg_wtw_t: Mapped[float] = mapped_column(Float, default=0.0)
    cii_attained: Mapped[float] = mapped_column(Float, default=0.0)
    cii_rating: Mapped[str] = mapped_column(String(2), default="C")

    speed_profile: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id, "vessel_id": self.vessel_id, "route_id": self.route_id,
            "fuel_id": self.fuel_id,
            "departure": self.departure.isoformat() if self.departure else None,
            "status": self.status, "distance_nm": self.distance_nm,
            "duration_hours": self.duration_hours, "fuel_tonnes": self.fuel_tonnes,
            "fuel_cost_usd": self.fuel_cost_usd, "co2_ttw_t": self.co2_ttw_t,
            "ghg_wtw_t": self.ghg_wtw_t, "cii_attained": self.cii_attained,
            "cii_rating": self.cii_rating,
            "speed_profile": json.loads(self.speed_profile or "[]"),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
