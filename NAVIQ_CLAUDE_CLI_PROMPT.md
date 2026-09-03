# NAVIQ — Claude CLI Build Prompt

> Paste this entire prompt into your Claude Code CLI session to build the complete project.

---

```
You are building NAVIQ — a Quantum-Inspired Green Fleet Intelligence Platform for Smart India Hackathon 2026 (Problem Statement ID: SIH26138, Theme: Clean & Green Technology).

This is a FULLY FUNCTIONAL web application, not a mockup. Build it to work with real algorithms, real data flows, and real computations.

## PROJECT OVERVIEW

NAVIQ is a multi-objective maritime decision platform that:
1. PREDICTS vessel fuel consumption using physics-informed deep learning
2. OPTIMIZES fleet deployment, routing, speed, and fuel type using hybrid quantum-inspired algorithms (QUBO + QPSO)
3. ENSURES IMO CII compliance as a hard constraint inside the optimizer
4. COMPARES alternative fuels on a Well-to-Wake lifecycle basis
5. PRESENTS Pareto-optimal trade-offs on an interactive dashboard

## TECH STACK (Use exactly this)

Backend:
- Python 3.11+
- FastAPI (REST API + WebSocket for live optimization progress)
- Celery + Redis (async optimization tasks)
- PostgreSQL (vessel/voyage/result storage)
- SQLAlchemy (ORM)

ML & Computation:
- PyTorch (BiLSTM + Self-Attention prediction model)
- NumPy / SciPy (physics calculations)
- Custom QUBO solver (Simulated Quantum Annealing)
- Custom QPSO implementation

Frontend:
- React 18 + TypeScript + Vite
- Tailwind CSS (styling)
- Leaflet.js + React-Leaflet (interactive maritime maps with route visualization)
- Plotly.js or Recharts (Pareto front visualization, charts)
- Framer Motion (subtle animations)

Data:
- AIS data (simulated realistic dataset for demo)
- NOAA/Copernicus weather grid data (pre-processed sample)
- IMO CII reference lines (hard-coded from MEPC guidelines)

## PROJECT STRUCTURE

Create this exact folder structure:

```
naviq/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app entry
│   │   ├── config.py                  # Settings, env vars
│   │   ├── database.py                # SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── vessel.py              # Vessel ORM model
│   │   │   ├── voyage.py              # Voyage ORM model
│   │   │   ├── optimization_result.py # Result storage
│   │   │   └── fuel.py                # Fuel properties model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── vessel.py              # Pydantic schemas
│   │   │   ├── voyage.py
│   │   │   ├── optimization.py
│   │   │   └── prediction.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── vessels.py         # CRUD for vessels
│   │   │   │   ├── voyages.py         # Voyage management
│   │   │   │   ├── prediction.py      # Fuel prediction endpoint
│   │   │   │   ├── optimization.py    # Run optimization endpoint
│   │   │   │   ├── compliance.py      # CII/AER calculation
│   │   │   │   ├── fuel_comparison.py # WtW fuel comparison
│   │   │   │   └── dashboard.py       # Dashboard data aggregation
│   │   │   └── websocket.py           # Live optimization updates
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── prediction/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── model.py           # BiLSTM + Self-Attention PyTorch model
│   │   │   │   ├── physics_loss.py    # Physics-informed loss function
│   │   │   │   ├── data_processor.py  # Feature engineering, normalization
│   │   │   │   └── predictor.py       # Inference wrapper with uncertainty
│   │   │   ├── physics/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── resistance.py      # Hydrodynamic resistance model (Holtrop-Mennen simplified)
│   │   │   │   ├── propulsion.py      # Shaft power, propulsive energy
│   │   │   │   └── fuel_conversion.py # Multi-fuel energy-based conversion
│   │   │   ├── optimization/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── qubo_solver.py     # QUBO formulation + Simulated Quantum Annealing
│   │   │   │   ├── qpso_solver.py     # Quantum PSO for continuous speed optimization
│   │   │   │   ├── hybrid_optimizer.py # Two-stage orchestrator
│   │   │   │   ├── objectives.py      # Multi-objective functions (fuel, cost, GHG, delay, risk)
│   │   │   │   └── constraints.py     # CII constraint, capacity, compatibility
│   │   │   ├── compliance/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── cii_calculator.py  # CII/AER rating calculation
│   │   │   │   ├── imo_rules.py       # Version-controlled IMO reduction factors
│   │   │   │   └── seemp.py           # SEEMP compliance tracking
│   │   │   └── emissions/
│   │   │       ├── __init__.py
│   │   │       ├── wtw_calculator.py  # Well-to-Wake emissions
│   │   │       ├── fuel_properties.py # LHV, EF, CF for all fuels
│   │   │       └── shore_power.py     # Cold ironing decision model
│   │   ├── data/
│   │   │   ├── sample_ais.json        # Simulated AIS data for demo
│   │   │   ├── sample_weather.json    # Sample weather grid
│   │   │   ├── fuel_database.json     # Fuel properties (HFO, VLSFO, LNG, MeOH, NH3, H2)
│   │   │   ├── imo_cii_reference.json # CII reference lines by ship type
│   │   │   └── ports.json             # Port locations with shore power availability
│   │   └── tasks/
│   │       ├── __init__.py
│   │       └── optimization_task.py   # Celery task for async optimization
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   │   │   ├── Header.tsx          # Top bar with NAVIQ branding
│   │   │   │   └── Layout.tsx          # Main layout wrapper
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardPage.tsx   # Main dashboard overview
│   │   │   │   ├── FleetOverview.tsx   # Fleet status cards
│   │   │   │   ├── CIIGauge.tsx        # CII rating gauge (A-E)
│   │   │   │   ├── EmissionsChart.tsx  # Emissions breakdown chart
│   │   │   │   └── KPICards.tsx        # Key metrics cards
│   │   │   ├── prediction/
│   │   │   │   ├── PredictionPage.tsx  # Fuel prediction interface
│   │   │   │   ├── PredictionForm.tsx  # Input form (vessel, route, weather)
│   │   │   │   ├── PredictionResult.tsx # Prediction output with uncertainty bands
│   │   │   │   └── FuelComparison.tsx  # Side-by-side multi-fuel comparison
│   │   │   ├── optimization/
│   │   │   │   ├── OptimizationPage.tsx # Optimization control panel
│   │   │   │   ├── RouteMap.tsx         # Interactive Leaflet map with optimized routes
│   │   │   │   ├── ParetoFront.tsx      # Interactive Pareto front plot
│   │   │   │   ├── SpeedProfile.tsx     # Speed profile visualization
│   │   │   │   ├── OptimizationProgress.tsx # Real-time optimization progress
│   │   │   │   └── SolutionComparison.tsx  # Compare solutions on Pareto front
│   │   │   ├── compliance/
│   │   │   │   ├── CompliancePage.tsx   # CII compliance dashboard
│   │   │   │   ├── CIITracker.tsx      # CII rating over time
│   │   │   │   ├── RegulatoryPanel.tsx # IMO rule version selector
│   │   │   │   └── ComplianceRisk.tsx  # Compliance risk probability display
│   │   │   ├── fleet/
│   │   │   │   ├── FleetPage.tsx       # Fleet management
│   │   │   │   ├── VesselCard.tsx      # Individual vessel card
│   │   │   │   └── VesselDetail.tsx    # Vessel detail view
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── MetricCard.tsx
│   │   │       └── FormulaDisplay.tsx  # LaTeX-style formula rendering
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts         # WebSocket hook for live updates
│   │   │   ├── useOptimization.ts      # Optimization state management
│   │   │   └── usePrediction.ts        # Prediction API hook
│   │   ├── services/
│   │   │   └── api.ts                  # API client (axios)
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript interfaces
│   │   └── utils/
│   │       ├── formatters.ts           # Number/unit formatters
│   │       └── constants.ts            # Fuel colors, CII rating colors
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── index.html
├── docker-compose.yml                  # Full stack compose
├── README.md                           # Project documentation
└── Makefile                            # Dev commands
```

## CORE ALGORITHMS — IMPLEMENT THESE FULLY

### 1. FUEL PREDICTION MODEL (backend/app/core/prediction/model.py)

Implement a BiLSTM with Time-Aware Feature-Similarity Self-Attention:

```python
# Architecture:
# Input: [batch, seq_len, features] where features include:
#   - speed_over_ground, draft_fore, draft_aft, rpm, shaft_power
#   - wind_speed, wind_direction, wave_height, wave_period, current_speed
#   - vessel_dwt, vessel_length, vessel_beam (static, repeated)
#
# Layers:
#   1. Feature embedding (Linear → ReLU → Dropout)
#   2. BiLSTM (2 layers, hidden=128)
#   3. Self-Attention with time-aware positional encoding
#   4. Output head: fuel_consumption + uncertainty (mean + log_variance)
#
# Loss function (physics-informed):
#   L = MSE(y_pred, y_true) + λ_phys * physics_violation_loss + λ_reg * L2_reg
#
# Physics violation: predicted fuel should be consistent with:
#   P_shaft ≈ R_total * V / η_prop
#   Energy conservation: fuel_energy ≥ propulsive_energy
```

The model should output BOTH a point prediction and uncertainty (epistemic + aleatoric).
Use Monte Carlo Dropout for epistemic uncertainty at inference time.

### 2. PHYSICS ENGINE (backend/app/core/physics/)

Implement simplified Holtrop-Mennen resistance estimation:

```python
# resistance.py:
# R_total = R_calm + R_wind + R_wave + R_current
# R_calm = f(vessel_length, beam, draft, speed, Cb) — simplified Holtrop
# R_wind = 0.5 * ρ_air * C_wind * A_frontal * V_wind_relative²
# R_wave = f(wave_height, wave_period, vessel_length) — ITTC simplified
# R_current = impact on effective speed

# propulsion.py:
# P_shaft = R_total * V / η_prop
# E_prop = ∫ P_shaft(t) dt  (trapezoidal integration over voyage legs)

# fuel_conversion.py:
# m_f = E_prop / (LHV_f * η_f)
# Support fuels: HFO, VLSFO, LNG, Methanol, Ammonia, Green Hydrogen
# Each fuel has: LHV (MJ/kg), η_engine, CF (tCO2/tFuel), EF_TtW, EF_WtT
```

### 3. QUBO SOLVER (backend/app/core/optimization/qubo_solver.py)

Implement Simulated Quantum Annealing for discrete fleet decisions:

```python
# Decision variables (binary):
# x[v,r] = 1 if vessel v assigned to route r
# x[v,f] = 1 if vessel v uses fuel f
# x[v,p] = 1 if vessel v uses shore power at port p
#
# QUBO matrix Q construction:
# Q = Q_cost + A1*Q_assignment + A2*Q_capacity + A3*Q_compatibility + A4*Q_cii
#
# Q_cost: fuel cost + emissions cost (from prediction model)
# Q_assignment: each vessel assigned to exactly one route (penalty if violated)
# Q_capacity: route demand ≤ vessel DWT
# Q_compatibility: fuel-engine compatibility
# Q_cii: CII compliance constraint
#
# Solver: Simulated Quantum Annealing
#   - Initialize random binary vector
#   - Temperature schedule: T(t) = T_max * (1 - t/t_max)^2
#   - Transverse field: Γ(t) = Γ_max * (1 - t/t_max) — quantum tunneling analog
#   - At each step: flip bit, compute ΔE, accept with probability min(1, exp(-ΔE/T))
#   - Quantum tunneling: with probability ∝ Γ, accept multi-bit flips
#   - Use parallel tempering: run M replicas at different temperatures, swap periodically
#   - Return best solution found across all replicas
```

### 4. QPSO SOLVER (backend/app/core/optimization/qpso_solver.py)

Implement Quantum Particle Swarm Optimization for continuous speed profiles:

```python
# Decision variables (continuous):
# v[leg] = speed for each voyage leg (in knots)
# Bounds: v_min ≤ v[leg] ≤ v_max (vessel-specific)
#
# QPSO Update:
#   mbest(t) = (1/N) * Σ p_i(t)  (mean of personal bests)
#   p_i(t) = φ * pbest_i + (1-φ) * gbest  where φ ~ U(0,1)
#   x_i(t+1) = p_i(t) ± α * |mbest(t) - x_i(t)| * ln(1/u)  where u ~ U(0,1)
#
# Contraction-expansion coefficient:
#   α(t) = α_max - (α_max - α_min) * t / t_max  (typically 1.0 → 0.5)
#
# Objective function per particle:
#   J = w_F * FuelCost(v) + w_G * GHG(v) + w_D * Delay(v) + w_R * RiskPenalty(v)
#   where FuelCost uses the physics engine + prediction model
#   RiskPenalty = λ * σ(FuelPrediction) if uncertainty-aware mode
#
# Constraint handling:
#   - Speed bounds: clamp to [v_min, v_max]
#   - ETA window: penalize if arrival outside window
#   - CII: P(CII > CII_limit) ≤ ε — compute from predicted fuel distribution
#
# N = 30 particles, t_max = 200 iterations
```

### 5. HYBRID OPTIMIZER (backend/app/core/optimization/hybrid_optimizer.py)

Two-stage orchestrator:

```python
# Stage 1: QUBO (discrete decisions)
#   Input: fleet of vessels, set of routes, fuel options, port shore-power data
#   Output: vessel-route assignments, fuel selections, shore-power decisions
#
# Stage 2: QPSO (continuous speed per assigned route)
#   Input: each vessel-route pair from Stage 1
#   Output: optimal speed profile per leg, expected fuel, ETA, emissions
#
# Multi-objective: generate K solutions by varying weight vectors
#   w_vectors = generate_weight_vectors(n_objectives=5, n_solutions=20)
#   For each w: run Stage1 → Stage2
#   Collect all solutions → compute Pareto front
#   Return non-dominated solutions
#
# Rolling horizon: re-optimize every N hours with updated weather forecasts
```

### 6. CII CALCULATOR (backend/app/core/compliance/cii_calculator.py)

```python
# CO2 = Σ_f (m_f * CF_f)  — sum over all fuels used
# AER = CO2 / (DWT * Distance)  — for bulk/tanker
#
# CII Rating:
#   CII_ref = a * DWT^(-c)  — reference line (a, c from IMO tables per ship type)
#   CII_required = CII_ref * (1 - Z/100)  — Z = annual reduction factor
#   Rating boundaries: d1, d2, d3, d4 (from IMO MEPC tables)
#   A: CII ≤ d1 * CII_ref
#   B: d1 < CII ≤ d2 * CII_ref
#   C: d2 < CII ≤ d3 * CII_ref
#   D: d3 < CII ≤ d4 * CII_ref
#   E: CII > d4 * CII_ref
#
# Version control: store reduction factors Z and boundaries in configurable JSON
# User can adjust via slider (scenario analysis)
```

### 7. WTW EMISSIONS (backend/app/core/emissions/wtw_calculator.py)

```python
# For each fuel f:
#   m_f = E_prop / (LHV_f * η_f)
#   GHG_TtW = m_f * EF_TtW_f  (Tank-to-Wake)
#   GHG_WtT = m_f * EF_WtT_f  (Well-to-Tank: production, transport, storage)
#   GHG_WtW = GHG_WtT + GHG_TtW
#   CI_WtW = GHG_WtW / (m_f * LHV_f)  (lifecycle carbon intensity, gCO2e/MJ)
#
# Fuel database (implement with real values):
# HFO:     LHV=40.2 MJ/kg, CF=3.114 tCO2/tFuel, EF_TtW=3.114, EF_WtT=0.6
# VLSFO:   LHV=41.0 MJ/kg, CF=3.151, EF_TtW=3.151, EF_WtT=0.5
# LNG:     LHV=49.1 MJ/kg, CF=2.750, EF_TtW=2.750, EF_WtT=0.7 (methane slip)
# Methanol: LHV=19.9 MJ/kg, CF=1.375, EF_TtW=1.375, EF_WtT varies (grey/green)
# Ammonia: LHV=18.6 MJ/kg, CF=0.0, EF_TtW≈0, EF_WtT varies (grey/green)
# Green H2: LHV=120.0 MJ/kg, CF=0.0, EF_TtW=0, EF_WtT varies by electrolysis source
#
# η_engine varies by fuel type (dual-fuel engine penalties included)
```

## FRONTEND — BUILD THESE PAGES

### PAGE 1: DASHBOARD (/)
- Hero section: NAVIQ branding with maritime-themed dark gradient background (deep navy #0A1628 to ocean blue #0F2B46)
- KPI row: Total Fleet Fuel Saved (tonnes), CO2 Reduction (%), Fleet CII Rating, Active Optimizations
- Fleet map: Leaflet map showing all vessels with color-coded CII status (A=green to E=red)
- Charts: Emissions breakdown (stacked bar by fuel type), CII trend over time (line chart)
- Recent optimization results table

### PAGE 2: PREDICTION (/prediction)
- Input form: Select vessel, enter route waypoints (clickable on map), set weather conditions (or auto-fetch)
- "Predict" button → calls backend prediction API
- Results: Fuel consumption prediction with ±σ uncertainty band (shaded area chart)
- Multi-fuel comparison: Side-by-side cards showing HFO vs LNG vs MeOH vs NH3 vs H2
  - Each card shows: fuel consumption (tonnes), cost ($), TtW emissions, WtW emissions, CII impact
- Physics breakdown: Show R_calm, R_wind, R_wave, R_current as stacked bar

### PAGE 3: OPTIMIZATION (/optimization)
- Fleet selector: Choose vessels and routes to optimize
- Objective weights: Sliders for fuel cost, GHG, delay, compliance risk weights
- "Run Optimization" → triggers Celery task
- Live progress: WebSocket-driven progress bar showing QUBO annealing temperature + QPSO iteration
- Results:
  - Interactive Pareto front (Plotly scatter: x=Fuel Cost, y=GHG, color=CII rating)
  - Click any point on Pareto → shows full solution:
    - Route on map with speed profile color coding
    - Vessel assignments table
    - Fuel selections
    - Shore power decisions
    - Speed profile chart (speed vs. distance)
    - ETA, total fuel, total cost, total emissions
  - Solution comparison: Select 2-3 solutions from Pareto to compare side-by-side

### PAGE 4: COMPLIANCE (/compliance)
- CII gauge: Large circular gauge showing current fleet CII rating (A-E) with color
- CII timeline: Predicted CII trajectory for the year (line chart with A/B/C/D/E zones shaded)
- Regulatory panel: IMO reduction factor slider (scenario: what if Z goes from 7% to 11%?)
- Per-vessel CII table: Each vessel's current and projected CII
- Compliance risk: Show P(CII > CII_limit) for each vessel
- SEEMP actions: Recommended corrective actions if trending toward D/E rating

### PAGE 5: FLEET (/fleet)
- Vessel cards grid: Each card shows vessel name, type, DWT, current fuel, current CII rating
- Add/edit vessel form
- Vessel detail page: Historical voyages, fuel consumption trend, CII history

## DESIGN SYSTEM

- Primary colors: Deep Navy (#0A1628), Ocean Blue (#1E3A5F), Teal Accent (#00BFA6), Warm Amber (#F59E0B)
- CII colors: A=#22C55E, B=#84CC16, C=#F59E0B, D=#F97316, E=#EF4444
- Font: Inter for UI, JetBrains Mono for formulas/metrics
- Dark theme by default (maritime industry convention)
- Cards: bg-slate-800/50 with subtle border, rounded-xl
- Maps: Dark tile layer (CartoDB Dark Matter)
- Charts: Plotly dark theme with teal/amber accent colors

## SAMPLE DATA — GENERATE REALISTIC DEMO DATA

Create sample data for demo purposes:

### Vessels (5 ships):
1. MV Pacific Voyager — Bulk Carrier, DWT 82,000, Speed 12-15 kn, HFO
2. MV Green Horizon — Container Ship, DWT 65,000, Speed 14-22 kn, VLSFO
3. MV Coral Breeze — Tanker, DWT 120,000, Speed 11-15 kn, HFO
4. MV Arctic Pioneer — LNG Carrier, DWT 95,000, Speed 16-19.5 kn, LNG (dual-fuel)
5. MV Sagar Shakti — General Cargo, DWT 28,000, Speed 10-14 kn, VLSFO

### Routes (4 routes):
1. Mumbai → Singapore (2,800 nm) via Arabian Sea
2. Chennai → Colombo (650 nm) coastal
3. Mundra → Fujairah (900 nm) via Gulf
4. Visakhapatnam → Yokohama (4,200 nm) via South China Sea

### Weather: Generate 7-day forecast grids for each route with:
- Wind: 5-25 knots, varying by location
- Waves: 0.5-3.5m significant wave height
- Currents: 0.2-1.5 knots

### Ports with shore power:
- Singapore: Available, $0.15/kWh
- Mumbai: Planned, estimated $0.12/kWh
- Fujairah: Not available
- Yokohama: Available, $0.18/kWh

## API ENDPOINTS

```
GET    /api/v1/vessels              — List all vessels
POST   /api/v1/vessels              — Create vessel
GET    /api/v1/vessels/{id}         — Get vessel detail
PUT    /api/v1/vessels/{id}         — Update vessel

GET    /api/v1/voyages              — List voyages
POST   /api/v1/voyages              — Create voyage

POST   /api/v1/predict              — Run fuel prediction
  Body: { vessel_id, route_waypoints, weather_conditions, fuel_type }
  Response: { fuel_consumption, uncertainty, physics_breakdown, multi_fuel_comparison }

POST   /api/v1/optimize             — Start optimization (async)
  Body: { vessel_ids, route_ids, objectives_weights, constraints }
  Response: { task_id }

GET    /api/v1/optimize/{task_id}   — Get optimization status/results
  Response: { status, progress, pareto_solutions[] }

WS     /ws/optimization/{task_id}   — Live optimization progress

GET    /api/v1/compliance/cii       — Calculate fleet CII
POST   /api/v1/compliance/scenario  — Run CII scenario (what-if)

GET    /api/v1/emissions/wtw        — WtW comparison for voyage
POST   /api/v1/emissions/compare    — Compare fuels for a route

GET    /api/v1/dashboard/summary    — Dashboard KPI data
```

## IMPORTANT IMPLEMENTATION NOTES

1. The QUBO solver must ACTUALLY work — implement simulated quantum annealing with real temperature scheduling, not a placeholder. Show the annealing curve in the UI.

2. The QPSO must ACTUALLY work — implement the quantum-behavior update rule, not standard PSO. Show convergence in the UI.

3. CII calculation must follow real IMO methodology — use actual CII reference line parameters for bulk carriers, tankers, container ships from MEPC tables.

4. Pareto front must be computed correctly — use non-dominated sorting (NSGA-II style) to identify the Pareto frontier.

5. Uncertainty must be real — use Monte Carlo Dropout (run N forward passes with dropout enabled during inference, compute mean and std).

6. The physics engine must be physically consistent — shaft power must equal resistance × speed / efficiency. Energy must balance.

7. WtW emissions must include upstream — don't just multiply fuel mass by a single factor. Show WtT and TtW separately.

8. Shore power decision must be in the QUBO — it's a real binary variable, not just a UI toggle.

9. Speed profile must be per-leg — not a single speed for the whole voyage. Show speed varying along the route.

10. Weather data must affect the prediction — wind/wave conditions must change the predicted resistance and therefore fuel consumption.

## RUN INSTRUCTIONS

After building, the project should start with:
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

For demo mode (without PostgreSQL/Redis), implement an in-memory fallback using Python dicts and asyncio (no Celery needed for demo).

## BUILD ORDER

1. First: Backend data models + sample data + fuel properties database
2. Second: Physics engine (resistance, propulsion, fuel conversion)
3. Third: QUBO solver + QPSO solver + hybrid optimizer
4. Fourth: CII calculator + WtW emissions
5. Fifth: FastAPI endpoints + prediction model (use physics engine as initial predictor, train BiLSTM if time permits, otherwise use physics-based prediction with noise for demo)
6. Sixth: Frontend — Dashboard → Optimization → Prediction → Compliance → Fleet
7. Last: Polish UI, add animations, test all flows

Start building now. Create every file with complete, working code. No placeholders, no TODOs, no "implement later" comments. Every algorithm must be functional.
```

---

## ADDITIONAL CONTEXT FOR YOUR CLAUDE CLI SESSION

After pasting the main prompt above, you can follow up with these targeted prompts as needed:

### If the BiLSTM model is too complex for demo:
```
For the demo, replace the BiLSTM prediction model with a physics-based predictor that uses the Holtrop-Mennen resistance model directly + Gaussian noise for uncertainty estimation. This gives us a working prediction without needing training data. Keep the BiLSTM model architecture defined but use the physics predictor as the default backend.
```

### To add the formulas display in the UI:
```
Add a "Technical Details" expandable panel on each page that shows the mathematical formulas being used:
- Prediction page: ŷ_t = f_θ(X, S, W) and L = L_data + λ_phys·L_phys
- Optimization page: QUBO min x^T·Q·x and QPSO update rule
- Compliance page: AER = CO2 / (DWT × Distance)
- Emissions page: m_f = E_prop / (LHV_f · η_f) and GHG_WtW = GHG_WtT + GHG_TtW
Use KaTeX for rendering. Install katex npm package.
```

### To add the SIH branding:
```
Add an "About" page at /about that shows:
- SMART INDIA HACKATHON 2026
- Problem Statement ID: SIH26138
- Theme: Clean & Green Technology
- Organisation: Egreen Quanta
- Project: NAVIQ — Quantum-Inspired Green Fleet Intelligence Platform
- Team name and ID placeholders
- Core innovation statement
- References section with the research papers
```

### To make it deployable:
```
Add Docker Compose configuration to run the entire stack:
- frontend (nginx serving built React)
- backend (uvicorn FastAPI)
- redis (for Celery if needed)
- postgres (or sqlite for lightweight demo)
Create a single `docker-compose up` that starts everything.
```
