"""Quantum-behaved Particle Swarm Optimisation for continuous speed profiles.

Classical PSO gives each particle a velocity and a trajectory. QPSO discards
velocity entirely: a particle is a quantum object bound in a delta potential
well centred on its local attractor p_i, so its position is sampled from the
well's probability density rather than stepped along a path.

    mbest(t) = (1/N) * sum_i pbest_i               (mean best position)
    p_i      = phi * pbest_i + (1 - phi) * gbest,   phi ~ U(0,1)
    x_i(t+1) = p_i +/- alpha * |mbest - x_i| * ln(1/u),  u ~ U(0,1)

Because ln(1/u) is unbounded, a particle has finite probability of appearing
anywhere in the search space at any iteration -- the swarm can never be trapped
in a basin the way a velocity-driven swarm can. The contraction-expansion
coefficient alpha decays 1.0 -> 0.5, tightening the wells into convergence.

This is the right solver for the continuous half of the problem: speed per leg
is a bounded real vector where the objective (fuel from a cubic power law,
plus non-smooth ETA and CII penalties) is multimodal and has no useful gradient.

References
----------
Sun, Feng & Xu (2004) "Particle swarm optimization with particles having
    quantum behavior", IEEE CEC 2004.
Sun, Fang, Wu, Palade & Xu (2012) "Quantum-behaved particle swarm optimization:
    analysis of individual particle behavior and parameter selection",
    Evolutionary Computation 20(3).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable

import numpy as np


@dataclass
class QPSOTrace:
    iteration: list[int] = field(default_factory=list)
    best_fitness: list[float] = field(default_factory=list)
    mean_fitness: list[float] = field(default_factory=list)
    alpha: list[float] = field(default_factory=list)
    swarm_diversity: list[float] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "iteration": self.iteration,
            "best_fitness": [round(v, 6) for v in self.best_fitness],
            "mean_fitness": [round(v, 6) for v in self.mean_fitness],
            "alpha": [round(v, 6) for v in self.alpha],
            "swarm_diversity": [round(v, 6) for v in self.swarm_diversity],
        }


@dataclass
class QPSOSolution:
    x: np.ndarray
    fitness: float
    trace: QPSOTrace
    iterations: int
    converged_at: int
    evaluations: int

    def to_dict(self) -> dict:
        return {
            "solution": [round(float(v), 6) for v in self.x],
            "fitness": round(self.fitness, 6),
            "trace": self.trace.to_dict(),
            "iterations": self.iterations,
            "converged_at": self.converged_at,
            "evaluations": self.evaluations,
        }


class QPSO:
    """Quantum-behaved PSO over a box-bounded continuous domain."""

    def __init__(self, n_particles: int = 30, n_iterations: int = 200,
                 alpha_max: float = 1.0, alpha_min: float = 0.5,
                 seed: int | None = None):
        self.n_particles = max(4, n_particles)
        self.n_iterations = max(5, n_iterations)
        self.alpha_max = alpha_max
        self.alpha_min = alpha_min
        self.rng = np.random.default_rng(seed)
        self.evaluations = 0

    def alpha_at(self, iteration: int) -> float:
        """Linear contraction-expansion decay: exploration to exploitation."""
        frac = iteration / max(self.n_iterations - 1, 1)
        return self.alpha_max - (self.alpha_max - self.alpha_min) * frac

    def optimize(self, objective: Callable[[np.ndarray], float],
                 lower: np.ndarray, upper: np.ndarray,
                 progress_callback: Callable[[dict], None] | None = None,
                 trace_every: int = 4,
                 initial_guess: np.ndarray | None = None) -> QPSOSolution:
        lower = np.asarray(lower, dtype=float)
        upper = np.asarray(upper, dtype=float)
        dim = lower.size
        N = self.n_particles
        self.evaluations = 0

        # Latin-hypercube-ish initialisation for even coverage of the box.
        positions = lower + (upper - lower) * self.rng.random((N, dim))
        if initial_guess is not None:
            positions[0] = np.clip(initial_guess, lower, upper)

        fitness = np.array([self._evaluate(objective, p) for p in positions])
        pbest = positions.copy()
        pbest_fitness = fitness.copy()

        g_idx = int(np.argmin(pbest_fitness))
        gbest = pbest[g_idx].copy()
        gbest_fitness = float(pbest_fitness[g_idx])
        converged_at = 0

        trace = QPSOTrace()

        for it in range(self.n_iterations):
            alpha = self.alpha_at(it)
            # mbest: the swarm's centre of mass in personal-best space. Distance
            # from it sets each particle's well width, so a converged swarm
            # searches locally and a scattered one searches globally.
            mbest = pbest.mean(axis=0)

            for i in range(N):
                phi = self.rng.random(dim)
                # Local attractor: a stochastic blend of personal and global best.
                p = phi * pbest[i] + (1.0 - phi) * gbest

                u = self.rng.random(dim)
                u = np.clip(u, 1e-12, 1.0 - 1e-12)
                # The delta-well quantum position sample.
                L = alpha * np.abs(mbest - positions[i])
                step = L * np.log(1.0 / u)
                # Symmetric sign: the well is two-sided.
                sign = np.where(self.rng.random(dim) < 0.5, -1.0, 1.0)
                candidate = p + sign * step

                # Reflect at the bounds rather than clamping: clamping piles
                # particles onto the boundary and kills diversity there.
                candidate = self._reflect(candidate, lower, upper)
                positions[i] = candidate

                f = self._evaluate(objective, candidate)
                if f < pbest_fitness[i]:
                    pbest_fitness[i] = f
                    pbest[i] = candidate.copy()
                    if f < gbest_fitness:
                        gbest_fitness = float(f)
                        gbest = candidate.copy()
                        converged_at = it

            if it % trace_every == 0 or it == self.n_iterations - 1:
                diversity = float(np.mean(np.linalg.norm(positions - positions.mean(axis=0), axis=1)))
                trace.iteration.append(it)
                trace.best_fitness.append(gbest_fitness)
                trace.mean_fitness.append(float(np.mean(pbest_fitness)))
                trace.alpha.append(alpha)
                trace.swarm_diversity.append(diversity)

                if progress_callback is not None:
                    progress_callback({
                        "phase": "qpso",
                        "iteration": it,
                        "total_iterations": self.n_iterations,
                        "progress": (it + 1) / self.n_iterations,
                        "best_fitness": round(gbest_fitness, 5),
                        "mean_fitness": round(float(np.mean(pbest_fitness)), 5),
                        "alpha": round(alpha, 5),
                        "swarm_diversity": round(diversity, 5),
                    })

        return QPSOSolution(
            x=gbest,
            fitness=gbest_fitness,
            trace=trace,
            iterations=self.n_iterations,
            converged_at=converged_at,
            evaluations=self.evaluations,
        )

    def _evaluate(self, objective: Callable[[np.ndarray], float], x: np.ndarray) -> float:
        self.evaluations += 1
        value = objective(x)
        if not math.isfinite(value):
            return float("inf")
        return float(value)

    @staticmethod
    def _reflect(x: np.ndarray, lower: np.ndarray, upper: np.ndarray) -> np.ndarray:
        """Fold out-of-bounds coordinates back inside the box."""
        span = upper - lower
        y = x.copy()
        for _ in range(4):
            below = y < lower
            above = y > upper
            if not below.any() and not above.any():
                break
            y = np.where(below, lower + (lower - y), y)
            y = np.where(above, upper - (y - upper), y)
            # Guard against a reflection overshooting the opposite wall.
            y = np.where((y < lower) | (y > upper), lower + span * 0.5, y)
        return np.clip(y, lower, upper)
