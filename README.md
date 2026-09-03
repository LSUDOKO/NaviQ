# NAVIQ — Quantum-Inspired Green Fleet Intelligence Platform

A maritime decarbonisation platform that predicts vessel fuel consumption, optimises fleet
deployment with hybrid quantum-inspired algorithms, enforces IMO carbon intensity compliance as
a hard constraint, and compares alternative fuels on a full lifecycle basis.

**Smart India Hackathon 2026** · Problem statement **SIH26138** · Clean & Green Technology

---

## What it actually does

Every algorithm here computes. Nothing is mocked.

| Component | Implementation | Verified against |
|---|---|---|
| Fuel prediction | BiLSTM + time-aware self-attention, physics-informed loss, MC-Dropout uncertainty | 5.11% validation MAPE, 73.8 kg/h MAE |
| Resistance model | Simplified Holtrop-Mennen: ITTC-1957 friction line, form factor, residuary, wind, waves | Service-speed engine loads of 47–69% MCR across the fleet |
| Discrete optimisation | QUBO via Simulated Quantum Annealing (path-integral, Trotter replicas, parallel tempering) | 7/8 global optima on random dense QUBOs vs exhaustive search |
| Continuous optimisation | Quantum-behaved Particle Swarm (delta-well sampling, no velocity term) | 0.0003 on 5-D Rastrigin, 1.3e-22 on 8-D sphere |
| CII compliance | MEPC.353(78) reference lines, MEPC.354(78) rating boundaries, per-type piecewise capacity | Fleet spread of A/A/B/C/C |
| Lifecycle emissions | Well-to-Tank + Tank-to-Wake, CH₄ slip at GWP100, negative WtT for e-fuels | Grey ammonia correctly flagged: −91% at funnel, **+51% lifecycle** |

### The seven differentiators

1. **Hybrid QUBO + QPSO.** Maritime optimisation has both discrete variables (which ship, which
   fuel, shore power yes/no) and continuous ones (speed per leg). Splitting them into
   purpose-built solvers beats forcing everything into one framework.
2. **Compliance in the loop.** The CII constraint lives *inside* the optimiser as
   `P(CII > limit) ≤ ε`. Every plan returned is compliant before the ship leaves port.
3. **Well-to-Wake lifecycle.** Hydrogen has zero emissions at the funnel and a large upstream
   burden. Reporting only tank-to-wake recommends exactly the wrong fuel.
4. **Physics-informed learning.** The loss penalises violations of energy conservation and cubic
   speed scaling, so predictions stay physical on weather the model never saw.
5. **Uncertainty-aware optimisation.** Minimises `E[F] + λ·σ(F)`, so a route that is 5% better on
   average but wild in storms does not win.
6. **Shore power as a decision variable.** `z_shore ∈ {0,1}` sits in the QUBO. The optimiser
   declines to connect where the port grid is dirtier than the ship's own auxiliaries.
7. **Multi-objective Pareto front.** Five competing objectives, non-dominated sorting (NSGA-II),
   and a frontier the fleet manager chooses from — because there is no single optimum.

---

## Running it

Two commands. No PostgreSQL, no Redis, no Celery — the demo stack is SQLite plus an in-process
async task runner, and it starts cold.

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # or: uv venv .venv
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs at <http://localhost:8000/docs>.

The trained model weights ship in `backend/app/data/model_weights.pt`. To retrain:

```bash
python -m app.core.prediction.train --epochs 80 --voyages 800
```

Without weights the service falls back to the analytic physics predictor and stays fully
functional.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` and `/ws` to port 8000.

### Docker

```bash
docker compose up --build
```

Frontend on 5173, backend on 8000.

---

## The pages

- **Overview** — fleet position, carbon intensity spread, emissions split into upstream and
  combustion.
- **Prediction** — fuel forecast with a 95% interval, resistance decomposition, and every
  alternative fuel compared on the same voyage.
- **Optimisation** — live annealing and swarm telemetry over WebSocket, an interactive Pareto
  front, and full plan detail per solution.
- **Compliance** — attained rating against the A–E boundaries, the projected trajectory as the
  IMO reduction factor tightens, scenario testing, and SEEMP corrective action plans.
- **Fleet** — vessel particulars, the speed-fuel curve, and fuel compatibility.
- **About** — method, differentiators and references.

---

## Architecture

```
backend/app/
├── core/
│   ├── physics/        resistance.py  propulsion.py  fuel_conversion.py  weather.py
│   ├── prediction/     model.py  physics_loss.py  data_processor.py  predictor.py  train.py
│   ├── optimization/   qubo_solver.py  qpso_solver.py  hybrid_optimizer.py
│   │                   objectives.py  constraints.py
│   ├── compliance/     cii_calculator.py  imo_rules.py  seemp.py
│   └── emissions/      wtw_calculator.py  shore_power.py
├── api/routes/         vessels  voyages  prediction  optimization
│                       compliance  fuel_comparison  dashboard
├── api/websocket.py    live optimisation telemetry
├── models/             SQLAlchemy ORM
├── schemas/            Pydantic validation
└── data/               fuel database, IMO CII tables, fleet, routes, ports, model weights

frontend/src/
├── pages/              Dashboard  Prediction  Optimization  Compliance  Fleet  About
├── components/         layout  common  prediction  optimization  compliance
├── hooks/              useWebSocket  useOptimization  usePrediction
└── services/api.ts     typed API client
```

### How a run flows

```
Fleet + routes + weights
        │
        ▼
  Stage 1 — QUBO (Simulated Quantum Annealing)
  which vessel, which route, which fuel, shore power?
        │  assignments
        ▼
  Stage 2 — QPSO
  speed for every leg of every voyage
        │  speed profiles
        ▼
  Evaluate 5 objectives → repeat across weight vectors
        │
        ▼
  Non-dominated sort → Pareto front
```

---

## Data provenance

- Fuel properties: IMO MEPC.364(79), MEPC.1/Circ.905 LCA guidelines, EU FuelEU Maritime Annex II,
  IPCC AR6 GWP100 factors.
- CII reference lines and rating boundaries: MEPC.353(78), MEPC.354(78), MEPC.338(76).
- Ports and shore power: IAPH World Ports Sustainability Program, EU AFIR Article 9, Indian Ports
  Association Harit Sagar guidelines.
- Routes follow real navigable sea lanes; leg distances are computed from waypoint geodesics, so
  the map and the fuel figures reconcile.
- Weather is synthesised with monsoon seasonality and spatial correlation. Swap
  `core/physics/weather.py` for a NOAA GFS or Copernicus CMEMS feed in production.

## Key references

- Kadowaki & Nishimori (1998), *Quantum annealing in the transverse Ising model*, Phys. Rev. E 58.
- Martoňák, Santoro & Tosatti (2002), *Quantum annealing by the path-integral Monte Carlo method*,
  Phys. Rev. B 66.
- Sun, Feng & Xu (2004), *Particle swarm optimization with particles having quantum behavior*,
  IEEE CEC.
- Holtrop & Mennen (1982), *An approximate power prediction method*, Int. Shipbuilding Progress 29.
- Deb et al. (2002), *NSGA-II*, IEEE Trans. Evolutionary Computation 6.
- Gal & Ghahramani (2016), *Dropout as a Bayesian approximation*, ICML.
- Raissi, Perdikaris & Karniadakis (2019), *Physics-informed neural networks*, J. Comput. Phys. 378.

## Licence

See [LICENSE](LICENSE).
