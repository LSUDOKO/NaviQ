from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class VesselBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    imo: str = Field(..., min_length=1, max_length=16)
    flag: str = ""
    ship_type: str = Field(..., description="IMO ship type id, e.g. bulk_carrier")

    dwt: float = Field(..., gt=0)
    gross_tonnage: float = Field(0.0, ge=0)
    length_m: float = Field(..., gt=0)
    beam_m: float = Field(..., gt=0)
    draft_design_m: float = Field(..., gt=0)
    block_coefficient: float = Field(0.75, gt=0, le=1.0)
    wetted_surface_m2: float = Field(0.0, ge=0)
    frontal_area_m2: float = Field(0.0, ge=0)

    speed_min_kn: float = Field(8.0, gt=0)
    speed_max_kn: float = Field(18.0, gt=0)
    speed_service_kn: float = Field(13.0, gt=0)

    main_engine_kw: float = Field(10000.0, gt=0)
    aux_engine_kw: float = Field(1500.0, ge=0)
    propulsive_efficiency: float = Field(0.68, gt=0, le=1.0)

    current_fuel: str = "VLSFO"
    compatible_fuels: list[str] = Field(default_factory=lambda: ["VLSFO", "MGO"])
    shore_power_capable: bool = False
    built_year: int = 2015
    annual_distance_nm: float = Field(50000.0, ge=0)

    @field_validator("speed_max_kn")
    @classmethod
    def max_above_min(cls, v: float, info):
        minimum = info.data.get("speed_min_kn")
        if minimum is not None and v <= minimum:
            raise ValueError("speed_max_kn must exceed speed_min_kn")
        return v

    @field_validator("ship_type")
    @classmethod
    def known_ship_type(cls, v: str) -> str:
        from ..core.compliance.imo_rules import list_ship_types
        valid = {t["id"] for t in list_ship_types()}
        if v not in valid:
            raise ValueError(f"ship_type must be one of {sorted(valid)}")
        return v

    @field_validator("compatible_fuels")
    @classmethod
    def known_fuels(cls, v: list[str]) -> list[str]:
        from ..core.physics.fuel_conversion import load_fuel_database
        valid = set(load_fuel_database())
        unknown = set(v) - valid
        if unknown:
            raise ValueError(f"Unknown fuels: {sorted(unknown)}. Valid: {sorted(valid)}")
        return v


class VesselCreate(VesselBase):
    id: str | None = None


class VesselUpdate(BaseModel):
    name: str | None = None
    flag: str | None = None
    current_fuel: str | None = None
    compatible_fuels: list[str] | None = None
    shore_power_capable: bool | None = None
    speed_min_kn: float | None = None
    speed_max_kn: float | None = None
    speed_service_kn: float | None = None
    annual_distance_nm: float | None = None


class VesselOut(VesselBase):
    id: str

    model_config = {"from_attributes": True}
