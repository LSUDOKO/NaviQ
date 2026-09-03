"""Vessel ORM model."""

from __future__ import annotations

import json

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Vessel(Base):
    __tablename__ = "vessels"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    imo: Mapped[str] = mapped_column(String(16), nullable=False)
    flag: Mapped[str] = mapped_column(String(64), default="")
    ship_type: Mapped[str] = mapped_column(String(48), nullable=False)

    dwt: Mapped[float] = mapped_column(Float, nullable=False)
    gross_tonnage: Mapped[float] = mapped_column(Float, default=0.0)
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    beam_m: Mapped[float] = mapped_column(Float, nullable=False)
    draft_design_m: Mapped[float] = mapped_column(Float, nullable=False)
    block_coefficient: Mapped[float] = mapped_column(Float, default=0.75)
    wetted_surface_m2: Mapped[float] = mapped_column(Float, default=0.0)
    frontal_area_m2: Mapped[float] = mapped_column(Float, default=0.0)

    speed_min_kn: Mapped[float] = mapped_column(Float, default=8.0)
    speed_max_kn: Mapped[float] = mapped_column(Float, default=18.0)
    speed_service_kn: Mapped[float] = mapped_column(Float, default=13.0)

    main_engine_kw: Mapped[float] = mapped_column(Float, default=10000.0)
    aux_engine_kw: Mapped[float] = mapped_column(Float, default=1500.0)
    propulsive_efficiency: Mapped[float] = mapped_column(Float, default=0.68)

    current_fuel: Mapped[str] = mapped_column(String(24), default="VLSFO")
    compatible_fuels: Mapped[str] = mapped_column(Text, default="[]")
    shore_power_capable: Mapped[bool] = mapped_column(Boolean, default=False)

    built_year: Mapped[int] = mapped_column(Integer, default=2015)
    annual_distance_nm: Mapped[float] = mapped_column(Float, default=50000.0)

    def to_dict(self) -> dict:
        """Plain dict in the shape the physics and optimisation engines expect."""
        return {
            "id": self.id, "name": self.name, "imo": self.imo, "flag": self.flag,
            "ship_type": self.ship_type, "dwt": self.dwt,
            "gross_tonnage": self.gross_tonnage, "length_m": self.length_m,
            "beam_m": self.beam_m, "draft_design_m": self.draft_design_m,
            "block_coefficient": self.block_coefficient,
            "wetted_surface_m2": self.wetted_surface_m2,
            "frontal_area_m2": self.frontal_area_m2,
            "speed_min_kn": self.speed_min_kn, "speed_max_kn": self.speed_max_kn,
            "speed_service_kn": self.speed_service_kn,
            "main_engine_kw": self.main_engine_kw, "aux_engine_kw": self.aux_engine_kw,
            "propulsive_efficiency": self.propulsive_efficiency,
            "current_fuel": self.current_fuel,
            "compatible_fuels": json.loads(self.compatible_fuels or "[]"),
            "shore_power_capable": self.shore_power_capable,
            "built_year": self.built_year,
            "annual_distance_nm": self.annual_distance_nm,
        }
