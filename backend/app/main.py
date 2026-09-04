"""NAVIQ FastAPI application entry point."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import websocket
from .api.routes import (
    compliance,
    dashboard,
    fuel_comparison,
    optimization,
    prediction,
    vessels,
    voyages,
)
from .config import settings
from .database import init_db

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s")
logger = logging.getLogger("naviq")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database ready")

    # Warm the predictor so the first request does not pay the load cost.
    from .core.prediction.predictor import get_predictor
    predictor = get_predictor()
    logger.info("Predictor mode: %s", predictor.mode)
    if predictor.metrics:
        logger.info("Model validation MAPE: %s%%", predictor.metrics.get("final_val_mape_pct"))

    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.app_title,
    version=settings.version,
    lifespan=lifespan,
    description=(
        "Quantum-inspired multi-objective optimisation for maritime fleet "
        "decarbonisation. Physics-informed fuel prediction, hybrid QUBO/QPSO "
        "optimisation, IMO CII compliance as a constraint, and Well-to-Wake "
        "lifecycle emissions."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Surface domain errors as 422 rather than an opaque 500."""
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(KeyError)
async def key_error_handler(request: Request, exc: KeyError):
    return JSONResponse(status_code=404, content={"detail": str(exc).strip("'")})


prefix = settings.api_prefix
app.include_router(vessels.router, prefix=prefix)
app.include_router(voyages.router, prefix=prefix)
app.include_router(prediction.router, prefix=prefix)
app.include_router(optimization.router, prefix=prefix)
app.include_router(compliance.router, prefix=prefix)
app.include_router(fuel_comparison.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(websocket.router)


@app.get("/", tags=["meta"])
def root():
    return {
        "name": settings.app_name,
        "title": settings.app_title,
        "version": settings.version,
        "problem_statement": "SIH26138",
        "theme": "Clean & Green Technology",
        "docs": "/docs",
        "api": prefix,
    }


@app.get("/health", tags=["meta"])
def health():
    from .core.prediction.predictor import get_predictor
    predictor = get_predictor()
    return {
        "status": "ok",
        "version": settings.version,
        "predictor_mode": predictor.mode,
        "neural_model_loaded": predictor.model is not None,
    }


@app.get("/api/v1/about", tags=["meta"])
def about():
    """Project metadata and the references behind the implementation."""
    return {
        "project": "NAVIQ",
        "subtitle": "Quantum-Inspired Green Fleet Intelligence Platform",
        "event": "Smart India Hackathon 2026",
        "problem_statement_id": "SIH26138",
        "theme": "Clean & Green Technology",
        "organisation": "Egreen Quanta",
        "innovation": (
            "The first integrated maritime platform combining physics-informed deep "
            "learning, hybrid quantum-inspired QUBO/QPSO optimisation, Well-to-Wake "
            "lifecycle analysis and CII compliance as a hard constraint - all running "
            "on classical hardware."
        ),
        "differentiators": [
            "Hybrid QUBO + QPSO solver splitting discrete and continuous decisions",
            "CII compliance enforced inside the optimiser, not reported afterwards",
            "Well-to-Wake lifecycle emissions including upstream production",
            "Physics-informed deep learning respecting energy conservation",
            "Uncertainty-aware optimisation of E[F] + lambda*sigma(F)",
            "Shore power as a binary decision variable in the QUBO",
            "Multi-objective Pareto front across five competing objectives",
        ],
        "references": [
            "Kadowaki & Nishimori (1998), Quantum annealing in the transverse Ising model, Phys. Rev. E 58",
            "Martonak, Santoro & Tosatti (2002), Quantum annealing by the path-integral Monte Carlo method, Phys. Rev. B 66",
            "Sun, Feng & Xu (2004), Particle swarm optimization with particles having quantum behavior, IEEE CEC",
            "Holtrop & Mennen (1982), An approximate power prediction method, Int. Shipbuilding Progress 29",
            "Deb et al. (2002), A fast and elitist multiobjective genetic algorithm NSGA-II, IEEE Trans. Evol. Comput. 6",
            "Gal & Ghahramani (2016), Dropout as a Bayesian approximation, ICML",
            "Raissi, Perdikaris & Karniadakis (2019), Physics-informed neural networks, J. Comput. Phys. 378",
            "IMO MEPC.353(78), 2022 Guidelines on operational carbon intensity reference lines",
            "IMO MEPC.354(78), 2022 Guidelines on the operational carbon intensity rating of ships",
        ],
    }
