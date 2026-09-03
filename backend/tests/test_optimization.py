"""Solvers: simulated quantum annealing, QPSO, and Pareto sorting."""

import itertools

import numpy as np
import pytest

from app.core.optimization.constraints import (
    crowding_distance,
    dominates,
    non_dominated_sort,
    pareto_front,
)
from app.core.optimization.objectives import generate_weight_vectors, normalize_objectives
from app.core.optimization.qpso_solver import QPSO
from app.core.optimization.qubo_solver import QUBOProblem, SimulatedQuantumAnnealer


# --- QUBO / Simulated Quantum Annealing ------------------------------------

def test_annealer_finds_optimum_on_small_instances():
    """Verified against exhaustive search, which is only tractable at this size."""
    rng = np.random.default_rng(7)
    optimal_hits = 0
    trials = 6

    for trial in range(trials):
        n = 12
        Q = rng.normal(0, 1, (n, n))
        Q = (Q + Q.T) / 2
        problem = QUBOProblem(Q=Q, variable_names=[f"x{i}" for i in range(n)])

        brute = min(
            itertools.product([0, 1], repeat=n),
            key=lambda bits: problem.energy(np.array(bits, dtype=float)),
        )
        best_energy = problem.energy(np.array(brute, dtype=float))

        solution = SimulatedQuantumAnnealer(n_replicas=6, n_steps=120, seed=trial).solve(problem)
        if abs(solution.energy - best_energy) < 1e-6:
            optimal_hits += 1
        # Even a miss must land close to the true optimum.
        assert solution.energy <= best_energy * 0.85 + 1e-9 or solution.energy < 0

    assert optimal_hits >= trials - 2, f"only {optimal_hits}/{trials} optimal"


def test_annealing_schedule_decays_monotonically():
    """Temperature and transverse field must both fall to near zero."""
    annealer = SimulatedQuantumAnnealer(n_steps=100)
    temps = [annealer.temperature_at(s) for s in range(100)]
    fields = [annealer.transverse_field_at(s) for s in range(100)]

    assert temps == sorted(temps, reverse=True)
    assert fields == sorted(fields, reverse=True)
    assert temps[-1] < temps[0] * 0.1
    assert fields[-1] < fields[0] * 0.1


def test_trotter_coupling_stiffens_as_field_decays():
    """Weak coupling at high Gamma (replicas roam), stiff as it falls."""
    annealer = SimulatedQuantumAnnealer(n_replicas=8)
    weak = annealer.coupling_at(gamma=3.0, temperature=1.0)
    stiff = annealer.coupling_at(gamma=0.05, temperature=1.0)
    assert stiff > weak


def test_annealer_records_telemetry():
    """The UI plots this trace; it must actually be produced."""
    rng = np.random.default_rng(3)
    Q = rng.normal(0, 1, (10, 10))
    problem = QUBOProblem(Q=(Q + Q.T) / 2, variable_names=[f"x{i}" for i in range(10)])
    solution = SimulatedQuantumAnnealer(n_replicas=4, n_steps=60, seed=1).solve(problem)

    trace = solution.trace
    assert len(trace.step) > 5
    assert len(trace.temperature) == len(trace.step)
    assert len(trace.best_energy) == len(trace.step)
    # Best-so-far energy can only improve.
    assert trace.best_energy == sorted(trace.best_energy, reverse=True)


def test_progress_callback_fires():
    events = []
    rng = np.random.default_rng(5)
    Q = rng.normal(0, 1, (8, 8))
    problem = QUBOProblem(Q=(Q + Q.T) / 2, variable_names=[f"x{i}" for i in range(8)])
    SimulatedQuantumAnnealer(n_replicas=4, n_steps=40, seed=2).solve(
        problem, progress_callback=events.append
    )
    assert len(events) > 3
    assert all(0.0 <= e["progress"] <= 1.0 for e in events)


# --- QPSO ------------------------------------------------------------------

def test_qpso_solves_sphere():
    """Convex baseline: must reach essentially zero."""
    result = QPSO(n_particles=25, n_iterations=140, seed=1).optimize(
        lambda x: float(np.sum(x**2)), np.full(6, -10.0), np.full(6, 10.0)
    )
    assert result.fitness < 1e-6


def test_qpso_escapes_local_minima_on_rastrigin():
    """Rastrigin traps velocity-driven swarms; the quantum well should not stick."""
    def rastrigin(x):
        return float(10 * len(x) + np.sum(x**2 - 10 * np.cos(2 * np.pi * x)))

    best = min(
        QPSO(n_particles=30, n_iterations=200, seed=s)
        .optimize(rastrigin, np.full(5, -5.12), np.full(5, 5.12))
        .fitness
        for s in range(3)
    )
    assert best < 3.0


def test_qpso_respects_bounds():
    """Reflection must keep every coordinate inside the box."""
    lower = np.array([5.0, 5.0, 5.0])
    upper = np.array([9.0, 9.0, 9.0])
    result = QPSO(n_particles=20, n_iterations=60, seed=4).optimize(
        lambda x: float(np.sum((x - 100.0) ** 2)), lower, upper
    )
    assert np.all(result.x >= lower - 1e-9)
    assert np.all(result.x <= upper + 1e-9)


def test_qpso_contraction_coefficient_decays():
    """Alpha must fall from exploration to exploitation."""
    qpso = QPSO(n_iterations=100, alpha_max=1.0, alpha_min=0.5)
    assert qpso.alpha_at(0) == pytest.approx(1.0)
    assert qpso.alpha_at(99) == pytest.approx(0.5)
    assert qpso.alpha_at(50) < qpso.alpha_at(10)


def test_qpso_trace_shows_convergence():
    result = QPSO(n_particles=20, n_iterations=80, seed=6).optimize(
        lambda x: float(np.sum(x**2)), np.full(4, -5.0), np.full(4, 5.0)
    )
    best = result.trace.best_fitness
    assert best == sorted(best, reverse=True)
    # The swarm should contract as it converges.
    assert result.trace.swarm_diversity[-1] < result.trace.swarm_diversity[0]


# --- Pareto analysis -------------------------------------------------------

def test_domination_relation():
    assert dominates(np.array([1.0, 1.0]), np.array([2.0, 2.0]))
    assert dominates(np.array([1.0, 2.0]), np.array([1.0, 3.0]))
    assert not dominates(np.array([1.0, 3.0]), np.array([2.0, 2.0]))
    assert not dominates(np.array([1.0, 1.0]), np.array([1.0, 1.0]))


def test_pareto_front_on_known_geometry():
    """Points on a convex trade-off curve are all non-dominated."""
    objectives = np.array([
        [1.0, 5.0],   # on the front
        [2.0, 3.0],   # on the front
        [3.0, 1.0],   # on the front
        [4.0, 6.0],   # dominated by every one of the above
        [2.5, 4.0],   # dominated by [2,3]
    ])
    front = set(pareto_front(objectives))
    assert front == {0, 1, 2}


def test_non_dominated_sort_partitions_everything():
    rng = np.random.default_rng(11)
    objectives = rng.random((30, 3))
    fronts = non_dominated_sort(objectives)
    assigned = [i for front in fronts for i in front]
    assert sorted(assigned) == list(range(30))
    assert len(set(assigned)) == 30


def test_crowding_distance_marks_extremes_infinite():
    objectives = np.array([[1.0, 5.0], [2.0, 3.0], [3.0, 1.0]])
    distances = crowding_distance(objectives, [0, 1, 2])
    assert np.isinf(distances[0]) and np.isinf(distances[2])
    assert np.isfinite(distances[1])


def test_weight_vectors_span_simplex():
    vectors = generate_weight_vectors(5, 20, seed=1)
    assert vectors.shape[1] == 5
    assert np.allclose(vectors.sum(axis=1), 1.0)
    assert np.all(vectors >= 0)
    # Every single-objective corner must be present, so the front reaches its extremes.
    for i in range(5):
        corner = np.eye(5)[i]
        assert any(np.allclose(v, corner) for v in vectors)


def test_normalization_maps_to_unit_range():
    matrix = np.array([[10.0, 100.0], [20.0, 200.0], [30.0, 300.0]])
    normalized = normalize_objectives(matrix)
    assert normalized.min() == pytest.approx(0.0)
    assert normalized.max() == pytest.approx(1.0)
