"""Application settings, overridable by environment variables."""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    app_name: str = "NAVIQ"
    app_title: str = "NAVIQ - Quantum-Inspired Green Fleet Intelligence Platform"
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # SQLite by default so the demo runs with no external services.
    # Point this at PostgreSQL for a production deployment.
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'naviq.db'}"

    cors_origins: list[str] = [
        "http://localhost:5173", "http://localhost:5174",
        "http://127.0.0.1:5173", "http://localhost:3000",
        "http://localhost:4173",
    ]
    # Comma-separated extra origins from the environment, so a production
    # frontend domain can be added without a code change or rebuild.
    extra_cors_origins: str = ""

    @property
    def all_cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.extra_cors_origins.split(",") if o.strip()]
        return [*self.cors_origins, *extra]

    # Optimiser defaults, tuned so an interactive run finishes in seconds.
    qubo_steps: int = 180
    qubo_replicas: int = 8
    qpso_particles: int = 24
    qpso_iterations: int = 70
    default_pareto_solutions: int = 12

    compliance_year: int = 2026
    default_month: int = 7
    carbon_price_usd_per_tonne: float = 95.0

    class Config:
        env_prefix = "NAVIQ_"
        env_file = ".env"


settings = Settings()
