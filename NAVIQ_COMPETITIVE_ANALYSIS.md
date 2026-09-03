# NAVIQ — Competitive Analysis & Differentiation

## Existing Solutions Landscape (Researched via Firecrawl, Sep 2026)

### Commercial Platforms

| Platform | What It Does | What It LACKS |
|----------|-------------|---------------|
| **Sinay Hub** (France) | Maritime data platform, fuel consumption prediction, route optimization | No quantum-inspired methods, no WtW lifecycle analysis, no multi-fuel comparison, CII monitoring only |
| **Orca AI** (Israel, 1600+ vessels) | Computer vision bridge safety, fuel savings as side-effect | Focus is navigation safety not optimization, no fleet-level combinatorial optimization |
| **Nautilus Labs / Danelec** (acquired) | AI voyage optimization, vessel performance analytics | Classical ML only, no QUBO/QPSO, acquired and folded into hardware company |
| **Cetasol iHelm** | AI fuel optimization, digital twin | Classical optimization, no multi-fuel WtW, no compliance-in-loop |
| **Clarksons CII Tool** | CII reporting and assessment modeling | Monitoring/reporting only, NO optimization or prediction |
| **Marine Digital FOS** | Fuel optimization tracking | Tracking-focused, no AI prediction, no combinatorial optimization |
| **Varuna Marine** | CII rating optimization consulting | Advisory service, not a computational platform |

### Open-Source / Academic

| Project | What It Does | What It LACKS |
|---------|-------------|---------------|
| **52North Weather Routing Tool** | Isochrone-based weather routing | No AI, no fleet optimization, no emissions, single vessel only |
| **FEEMS (SINTEF)** | Marine machinery energy/emissions modeling | No optimization, no prediction, modeling library only |
| **PyQUBO / qubovert** | Generic QUBO formulation libraries | Not maritime-specific, no domain integration |
| **ngroup/qpso** | Generic QPSO Python implementation | Not domain-specific, toy examples only |

### Key Research Papers Found

| Paper | Gap NAVIQ Fills |
|-------|----------------|
| Arctic ship routing with D-Wave (arxiv:2512.10544) | Requires actual quantum hardware (D-Wave); NAVIQ runs on classical |
| QAOA for vehicle routing (arxiv:2604.16718) | Quantum hardware focused, not maritime-specific |
| Ship fuel ML (various) | Prediction only, no optimization coupling |
| QUBO transport optimization review (MDPI SmartCities) | Survey paper, no integrated maritime platform |

---

## NAVIQ's 7 Key Differentiators

### 1. HYBRID QUBO + QPSO SOLVER (Nobody else does this)
- Existing: Use EITHER genetic algorithms OR MILP OR single metaheuristic
- NAVIQ: Two-stage solver — QUBO with Simulated Quantum Annealing for discrete decisions (which ship goes where, which fuel, shore power yes/no) + QPSO for continuous speed optimization
- Why it matters: Maritime optimization has BOTH discrete and continuous variables — splitting them into purpose-built solvers is provably better than forcing everything into one framework

### 2. COMPLIANCE-IN-THE-LOOP (Not after-the-fact)
- Existing: Calculate CII after voyage, report it, hope for the best
- NAVIQ: CII constraint is INSIDE the optimizer: P(CII > CII_limit) ≤ ε
- Why it matters: Every generated route is guaranteed compliant before the ship leaves port

### 3. WELL-TO-WAKE LIFECYCLE EMISSIONS (Not just tailpipe)
- Existing: Compare fuels by LHV ratio alone (oversimplified)
- NAVIQ: Full WtW chain — GHG_WtW = GHG_WtT + GHG_TtW — including upstream production emissions
- Why it matters: Hydrogen has zero TtW emissions but massive WtT from electrolysis — ignoring this gives false comparison

### 4. PHYSICS-INFORMED DEEP LEARNING (Not black-box ML)
- Existing: Standard LSTM/XGBoost trained on data alone
- NAVIQ: BiLSTM + Self-Attention with physics loss L = L_data + λ_phys × L_phys
- Why it matters: Predictions respect energy conservation even on unseen weather conditions

### 5. UNCERTAINTY-AWARE OPTIMIZATION
- Existing: Point estimates → deterministic optimization
- NAVIQ: F_risk = E[F] + λ×σ(F) — optimizes for risk-adjusted fuel under weather uncertainty
- Why it matters: A route that's 5% better on average but has 50% variance in storms is actually worse

### 6. SHORE POWER AS OPTIMIZATION VARIABLE
- Existing: Shore power mentioned as feature, not optimized
- NAVIQ: z_shore ∈ {0,1} is a real binary variable in the QUBO — optimizer decides whether shore power at each port is worth it economically and environmentally
- Why it matters: At-berth emissions are 5-8% of total — treating them as a decision variable captures real savings

### 7. MULTI-OBJECTIVE PARETO FRONT (Not single-objective)
- Existing: Minimize fuel cost only, or minimize emissions only
- NAVIQ: Generate full Pareto frontier across Fuel × Cost × GHG × Delay × Compliance Risk, let fleet managers choose their trade-off
- Why it matters: There is no single "optimal" — a fleet manager needs to see the trade-off between arriving 2 hours late (saving $50K fuel) versus on-time (higher emissions)

---

## One-Line Pitch for Judges
"NAVIQ is the first integrated maritime platform that combines physics-informed deep learning, hybrid quantum-inspired QUBO/QPSO optimization, Well-to-Wake lifecycle analysis, and CII compliance-as-constraint — all running on classical hardware, producing Pareto-optimal green fleet decisions."

## Why This Wins SIH
1. **Technical depth**: 16 working formulas, real optimization algorithms, not just UI
2. **Research contribution**: No existing paper/product integrates all these components
3. **India relevance**: Reduces dependence on foreign maritime software (MoPSW Maritime Amrit Kaal Vision 2047)
4. **Working demo**: Fully functional web app with interactive Pareto front, not slides
5. **Clean & Green**: Directly addresses IMO 2030/2050 decarbonization targets
