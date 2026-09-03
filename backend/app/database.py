"""SQLAlchemy setup and demo-data seeding.

SQLite keeps the demo dependency-free. The models are plain SQLAlchemy 2.0 and
work unchanged against PostgreSQL by pointing NAVIQ_DATABASE_URL at it.
"""

from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

DATA_DIR = Path(__file__).resolve().parent / "data"

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def load_json(name: str) -> dict:
    with open(DATA_DIR / name) as fh:
        return json.load(fh)


def init_db() -> None:
    """Create tables and seed the demo fleet, routes and ports if empty."""
    from .models import Port, Route, Vessel  # noqa: F401  (registers metadata)

    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.query(Vessel).count() == 0:
            _seed(db)


def _seed(db: Session) -> None:
    from .models import Port, Route, Vessel

    for record in load_json("fleet.json")["vessels"]:
        db.add(Vessel(
            id=record["id"], name=record["name"], imo=record["imo"], flag=record["flag"],
            ship_type=record["ship_type"], dwt=record["dwt"],
            gross_tonnage=record["gross_tonnage"], length_m=record["length_m"],
            beam_m=record["beam_m"], draft_design_m=record["draft_design_m"],
            block_coefficient=record["block_coefficient"],
            wetted_surface_m2=record["wetted_surface_m2"],
            frontal_area_m2=record["frontal_area_m2"],
            speed_min_kn=record["speed_min_kn"], speed_max_kn=record["speed_max_kn"],
            speed_service_kn=record["speed_service_kn"],
            main_engine_kw=record["main_engine_kw"], aux_engine_kw=record["aux_engine_kw"],
            propulsive_efficiency=record["propulsive_efficiency"],
            current_fuel=record["current_fuel"],
            compatible_fuels=json.dumps(record["compatible_fuels"]),
            shore_power_capable=record["shore_power_capable"],
            built_year=record["built_year"], annual_distance_nm=record["annual_distance_nm"],
        ))

    for record in load_json("routes.json")["routes"]:
        db.add(Route(
            id=record["id"], name=record["name"],
            origin_port=record["origin_port"], destination_port=record["destination_port"],
            distance_nm=record["distance_nm"], cargo_demand_t=record["cargo_demand_t"],
            revenue_usd=record["revenue_usd"],
            eta_window_hours=json.dumps(record["eta_window_hours"]),
            waypoints=json.dumps(record["waypoints"]),
        ))

    for record in load_json("ports.json")["ports"]:
        db.add(Port(
            id=record["id"], name=record["name"], country=record["country"],
            lat=record["lat"], lon=record["lon"],
            shore_power=record["shore_power"], shore_power_kw=record["shore_power_kw"],
            electricity_usd_per_kwh=record["electricity_usd_per_kwh"],
            grid_ci_gco2_per_kwh=record["grid_ci_gco2_per_kwh"],
            berth_fee_usd_per_day=record["berth_fee_usd_per_day"],
            notes=record["notes"],
        ))

    db.commit()
