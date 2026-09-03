"""QUBO constraint encoding and Pareto non-dominated sorting.

Constraints become quadratic penalty blocks. The canonical one-hot form

    (sum_j x_j - 1)^2 = sum_j x_j + 2*sum_{j<k} x_j*x_k - 1

expands to a diagonal of -1 and off-diagonals of +2 (using x^2 = x for binary
variables), plus a constant offset. Inequalities like capacity are encoded as
one-sided penalties applied only to violating pairs.

Penalty weights must exceed the objective's dynamic range or the solver will
happily buy a constraint violation with an objective improvement -- so they are
scaled from the objective block rather than hard-coded.
"""

from __future__ import annotations

import numpy as np

from .qubo_solver import QUBOProblem


def build_fleet_qubo(vessels: list[dict], routes: list[dict], fuels: list[str],
                     cost_matrix: dict, cii_penalty_matrix: dict,
                     shore_power_matrix: dict | None = None,
                     penalty_scale: float = 3.0) -> QUBOProblem:
    """Assemble the fleet deployment QUBO.

    Variables
    ---------
    x[v,r,f] : vessel v sails route r on fuel f   (the joint assignment)
    z[v,p]   : vessel v draws shore power at port p

    Encoding the vessel-route-fuel choice jointly rather than as three separate
    variable families removes the need for consistency penalties linking them,
    which shrinks the penalty budget and makes the landscape far easier to anneal.
    """
    variable_names: list[str] = []
    variable_meta: list[dict] = []
    index: dict[tuple, int] = {}

    for v in vessels:
        for r in routes:
            for f in fuels:
                if f not in v.get("compatible_fuels", []):
                    continue  # incompatible pairs are excluded, not penalised
                key = ("assign", v["id"], r["id"], f)
                index[key] = len(variable_names)
                variable_names.append(f"x[{v['id']},{r['id']},{f}]")
                variable_meta.append({
                    "type": "assignment", "vessel_id": v["id"], "vessel_name": v["name"],
                    "route_id": r["id"], "route_name": r["name"], "fuel_id": f,
                })

    shore_power_matrix = shore_power_matrix or {}
    for v in vessels:
        for port_id, entry in shore_power_matrix.get(v["id"], {}).items():
            if not entry.get("feasible"):
                continue
            key = ("shore", v["id"], port_id)
            index[key] = len(variable_names)
            variable_names.append(f"z[{v['id']},{port_id}]")
            variable_meta.append({
                "type": "shore_power", "vessel_id": v["id"], "vessel_name": v["name"],
                "port_id": port_id, "port_name": entry.get("port_name", port_id),
            })

    n = len(variable_names)
    if n == 0:
        raise ValueError("No feasible vessel-route-fuel combinations: check fuel compatibility.")

    Q = np.zeros((n, n), dtype=float)
    offset = 0.0

    # ---- objective block: cost of each assignment on the diagonal ----
    magnitudes = []
    for key, i in index.items():
        if key[0] == "assign":
            _, vid, rid, fid = key
            cost = float(cost_matrix.get((vid, rid, fid), 0.0))
            Q[i, i] += cost
            magnitudes.append(abs(cost))
        else:
            _, vid, port_id = key
            entry = shore_power_matrix[vid][port_id]
            # Negative diagonal = a reward. Shore power is chosen when its
            # cost+emissions delta beats running auxiliaries.
            benefit = -float(entry.get("objective_benefit", 0.0))
            Q[i, i] += benefit
            magnitudes.append(abs(benefit))

    scale = max(magnitudes) if magnitudes else 1.0
    A = penalty_scale * max(scale, 1.0)

    # ---- C1: each vessel takes at most one route+fuel  (sum_j x_j - 1)^2 ----
    for v in vessels:
        group = [i for key, i in index.items() if key[0] == "assign" and key[1] == v["id"]]
        if not group:
            continue
        for i in group:
            Q[i, i] += -A          # linear term of the expansion
        for a in range(len(group)):
            for b in range(a + 1, len(group)):
                Q[group[a], group[b]] += A   # 2*A split symmetrically
                Q[group[b], group[a]] += A
        offset += A

    # ---- C2: each route served by exactly one vessel ----
    for r in routes:
        group = [i for key, i in index.items() if key[0] == "assign" and key[2] == r["id"]]
        if not group:
            continue
        for i in group:
            Q[i, i] += -A
        for a in range(len(group)):
            for b in range(a + 1, len(group)):
                Q[group[a], group[b]] += A
                Q[group[b], group[a]] += A
        offset += A

    # ---- C3: capacity -- vessel DWT must cover the route's cargo demand ----
    vessel_by_id = {v["id"]: v for v in vessels}
    route_by_id = {r["id"]: r for r in routes}
    for key, i in index.items():
        if key[0] != "assign":
            continue
        _, vid, rid, _ = key
        dwt = float(vessel_by_id[vid]["dwt"])
        demand = float(route_by_id[rid].get("cargo_demand_t", 0.0))
        if demand > dwt:
            # Penalty proportional to the shortfall: a near-miss is less bad
            # than a gross mismatch, which guides the anneal instead of just
            # walling it off.
            shortfall = (demand - dwt) / max(dwt, 1.0)
            Q[i, i] += A * (1.0 + shortfall)

    # ---- C4: CII compliance as a hard-ish constraint inside the optimizer ----
    for key, i in index.items():
        if key[0] != "assign":
            continue
        _, vid, rid, fid = key
        penalty = float(cii_penalty_matrix.get((vid, rid, fid), 0.0))
        Q[i, i] += penalty * A * 0.5

    # ---- C5: shore power only when the vessel is actually deployed ----
    # Reward z only if some assignment for that vessel is active; otherwise the
    # solver could bank the shore-power benefit for an idle ship.
    for v in vessels:
        shore_vars = [i for key, i in index.items() if key[0] == "shore" and key[1] == v["id"]]
        assign_vars = [i for key, i in index.items() if key[0] == "assign" and key[1] == v["id"]]
        for zi in shore_vars:
            Q[zi, zi] += A * 0.5          # cost of switching on
            for xi in assign_vars:
                Q[zi, xi] += -A * 0.25    # refunded when deployed
                Q[xi, zi] += -A * 0.25

    return QUBOProblem(Q=Q, variable_names=variable_names,
                       variable_meta=variable_meta, offset=offset)


# ---------------------------------------------------------------------------
# Pareto analysis
# ---------------------------------------------------------------------------

def dominates(a: np.ndarray, b: np.ndarray) -> bool:
    """True if a dominates b: no worse on every objective, strictly better on one."""
    return bool(np.all(a <= b) and np.any(a < b))


def non_dominated_sort(objectives: np.ndarray) -> list[list[int]]:
    """NSGA-II fast non-dominated sort. Returns fronts as lists of indices."""
    n = len(objectives)
    domination_count = np.zeros(n, dtype=int)
    dominated_solutions: list[list[int]] = [[] for _ in range(n)]
    fronts: list[list[int]] = [[]]

    for p in range(n):
        for q in range(n):
            if p == q:
                continue
            if dominates(objectives[p], objectives[q]):
                dominated_solutions[p].append(q)
            elif dominates(objectives[q], objectives[p]):
                domination_count[p] += 1
        if domination_count[p] == 0:
            fronts[0].append(p)

    i = 0
    while i < len(fronts) and fronts[i]:
        next_front: list[int] = []
        for p in fronts[i]:
            for q in dominated_solutions[p]:
                domination_count[q] -= 1
                if domination_count[q] == 0:
                    next_front.append(q)
        i += 1
        fronts.append(next_front)

    return [f for f in fronts if f]


def crowding_distance(objectives: np.ndarray, front: list[int]) -> np.ndarray:
    """NSGA-II crowding distance, for picking a well-spread subset of the front."""
    l = len(front)
    distance = np.zeros(l)
    if l <= 2:
        return np.full(l, np.inf)

    sub = objectives[front]
    for m in range(sub.shape[1]):
        order = np.argsort(sub[:, m])
        distance[order[0]] = np.inf
        distance[order[-1]] = np.inf
        span = sub[order[-1], m] - sub[order[0], m]
        if span < 1e-12:
            continue
        for k in range(1, l - 1):
            distance[order[k]] += (sub[order[k + 1], m] - sub[order[k - 1], m]) / span
    return distance


def pareto_front(objectives: np.ndarray) -> list[int]:
    """Indices of the non-dominated set."""
    fronts = non_dominated_sort(objectives)
    return fronts[0] if fronts else []


def hypervolume_2d(points: np.ndarray, reference: np.ndarray) -> float:
    """Exact 2-D hypervolume, used as a front-quality metric in the UI."""
    if len(points) == 0:
        return 0.0
    pts = points[np.argsort(points[:, 0])]
    volume = 0.0
    prev_x = pts[0, 0]
    best_y = reference[1]
    for x, y in pts:
        if y < best_y:
            volume += (reference[0] - x) * (best_y - y)
            best_y = y
        prev_x = x
    return float(max(0.0, volume))
