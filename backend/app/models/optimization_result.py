"""Persisted optimisation runs."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class OptimizationResult(Base):
    __tablename__ = "optimization_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(24), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    vessel_ids: Mapped[str] = mapped_column(Text, default="[]")
    route_ids: Mapped[str] = mapped_column(Text, default="[]")
    weights: Mapped[str] = mapped_column(Text, default="{}")

    n_solutions: Mapped[int] = mapped_column(Integer, default=0)
    n_pareto: Mapped[int] = mapped_column(Integer, default=0)
    runtime_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    best_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    best_ghg_t: Mapped[float] = mapped_column(Float, default=0.0)

    result_json: Mapped[str] = mapped_column(Text, default="{}")

    def to_dict(self, include_result: bool = False) -> dict:
        payload = {
            "id": self.id, "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "vessel_ids": json.loads(self.vessel_ids or "[]"),
            "route_ids": json.loads(self.route_ids or "[]"),
            "weights": json.loads(self.weights or "{}"),
            "n_solutions": self.n_solutions, "n_pareto": self.n_pareto,
            "runtime_seconds": self.runtime_seconds,
            "best_cost_usd": self.best_cost_usd, "best_ghg_t": self.best_ghg_t,
        }
        if include_result:
            payload["result"] = json.loads(self.result_json or "{}")
        return payload
