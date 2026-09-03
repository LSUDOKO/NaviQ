from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ObjectiveWeights(BaseModel):
    """Relative importance of each objective. Normalised to sum to 1 on use."""

    fuel_cost: float = Field(0.30, ge=0, le=1)
    ghg_wtw: float = Field(0.30, ge=0, le=1)
    delay: float = Field(0.15, ge=0, le=1)
    compliance_risk: float = Field(0.15, ge=0, le=1)
    risk_adjusted_fuel: float = Field(0.10, ge=0, le=1)

    def normalized(self) -> dict[str, float]:
        total = (self.fuel_cost + self.ghg_wtw + self.delay
                 + self.compliance_risk + self.risk_adjusted_fuel)
        if total <= 0:
            return {"fuel_cost": 0.2, "ghg_wtw": 0.2, "delay": 0.2,
                    "compliance_risk": 0.2, "risk_adjusted_fuel": 0.2}
        return {
            "fuel_cost": self.fuel_cost / total,
            "ghg_wtw": self.ghg_wtw / total,
            "delay": self.delay / total,
            "compliance_risk": self.compliance_risk / total,
            "risk_adjusted_fuel": self.risk_adjusted_fuel / total,
        }


class OptimizationRequest(BaseModel):
    vessel_ids: list[str] = Field(..., min_length=1)
    route_ids: list[str] = Field(..., min_length=1)
    fuel_ids: list[str] | None = Field(None, description="Candidate fuels. Defaults to all compatible.")
    weights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)

    n_solutions: int = Field(12, ge=3, le=40, description="Weight vectors to sweep.")
    year: int = Field(2026, ge=2019, le=2050)
    month: int = Field(7, ge=1, le=12)
    uncertainty_lambda: float = Field(1.0, ge=0, le=5,
                                      description="Risk aversion in E[F] + lambda*sigma(F).")

    qubo_steps: int = Field(180, ge=20, le=2000)
    qubo_replicas: int = Field(8, ge=2, le=32)
    qpso_particles: int = Field(24, ge=5, le=100)
    qpso_iterations: int = Field(70, ge=10, le=500)

    @field_validator("route_ids")
    @classmethod
    def routes_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("At least one route is required")
        return v


class OptimizationStatus(BaseModel):
    task_id: str
    status: str
    progress: float = 0.0
    phase: str = "pending"
    message: str = ""
    created_at: str | None = None
    completed_at: str | None = None
    runtime_seconds: float | None = None
    error: str | None = None
