"""Port ORM model and fuel property access.

Fuel properties stay in JSON rather than a table: they are reference data from
IMO and FuelEU guidelines, versioned with the code, not operator-editable rows.
"""

from __future__ import annotations

from sqlalchemy import Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Port(Base):
    __tablename__ = "ports"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    country: Mapped[str] = mapped_column(String(64), default="")
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    shore_power: Mapped[str] = mapped_column(String(24), default="unavailable")
    shore_power_kw: Mapped[float] = mapped_column(Float, default=0.0)
    electricity_usd_per_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    grid_ci_gco2_per_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    berth_fee_usd_per_day: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")

    def to_dict(self) -> dict:
        return {
            "id": self.id, "name": self.name, "country": self.country,
            "lat": self.lat, "lon": self.lon,
            "shore_power": self.shore_power, "shore_power_kw": self.shore_power_kw,
            "electricity_usd_per_kwh": self.electricity_usd_per_kwh,
            "grid_ci_gco2_per_kwh": self.grid_ci_gco2_per_kwh,
            "berth_fee_usd_per_day": self.berth_fee_usd_per_day,
            "notes": self.notes,
        }
