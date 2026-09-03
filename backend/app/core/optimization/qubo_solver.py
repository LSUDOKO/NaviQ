"""QUBO formulation and Simulated Quantum Annealing for discrete fleet decisions.

Problem form
------------
    minimise  x^T Q x     subject to  x in {0,1}^n

with Q assembled from an objective block plus quadratic penalty blocks that
encode the constraints:

    Q = Q_cost + A1*Q_assign + A2*Q_capacity + A3*Q_compat + A4*Q_cii + A5*Q_shore

Solver
------
Simulated Quantum Annealing (SQA) via the discrete-time path-integral mapping
of a transverse-field Ising model. The quantum system

    H(s) = -Gamma(s) * sum_i sigma^x_i  +  s * H_problem

is represented by P classical Trotter replicas coupled along an imaginary-time
dimension. The coupling strength

    J_perp = -(P / (2*beta)) * ln( tanh( beta*Gamma / P ) )

is weak while Gamma is large (replicas explore independently -- delocalisation)
and grows stiff as Gamma decays (replicas condense onto one answer). That is
the mechanism behind quantum tunnelling: a replica can sit on the far side of a
barrier at finite cost, and the ensemble follows if the far side is lower --
where a single classical chain would have to climb over the top.

This is the same annealing schedule D-Wave hardware implements physically; here
it runs on CPU, which is the point -- no quantum hardware dependency.

References
----------
Kadowaki & Nishimori (1998) "Quantum annealing in the transverse Ising model",
    Phys. Rev. E 58, 5355.
Martonak, Santoro & Tosatti (2002) "Quantum annealing by the path-integral
    Monte Carlo method", Phys. Rev. B 66, 094203.
Glover, Kochenberger & Du (2019) "A tutorial on formulating and using QUBO
    models", arXiv:1811.11538.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable

import numpy as np


@dataclass
class QUBOProblem:
    """A QUBO instance with a human-readable variable index."""

    Q: np.ndarray
    variable_names: list[str]
    variable_meta: list[dict] = field(default_factory=list)
    offset: float = 0.0

    @property
    def n(self) -> int:
        return len(self.variable_names)

    def energy(self, x: np.ndarray) -> float:
        """E(x) = x^T Q x + offset."""
        return float(x @ self.Q @ x) + self.offset

    def decode(self, x: np.ndarray) -> list[dict]:
        """Return the metadata of every variable set to 1."""
        return [
            {**(self.variable_meta[i] if i < len(self.variable_meta) else {}),
             "variable": self.variable_names[i]}
            for i in range(self.n) if x[i] == 1
        ]


@dataclass
class AnnealingTrace:
    """Per-step telemetry, streamed to the UI to visualise the anneal."""

    step: list[int] = field(default_factory=list)
    temperature: list[float] = field(default_factory=list)
    transverse_field: list[float] = field(default_factory=list)
    best_energy: list[float] = field(default_factory=list)
    mean_energy: list[float] = field(default_factory=list)
    acceptance_rate: list[float] = field(default_factory=list)
    tunneling_events: list[int] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "temperature": [round(v, 6) for v in self.temperature],
            "transverse_field": [round(v, 6) for v in self.transverse_field],
            "best_energy": [round(v, 6) for v in self.best_energy],
            "mean_energy": [round(v, 6) for v in self.mean_energy],
            "acceptance_rate": [round(v, 6) for v in self.acceptance_rate],
            "tunneling_events": self.tunneling_events,
        }


@dataclass
class QUBOSolution:
    x: np.ndarray
    energy: float
    assignments: list[dict]
    trace: AnnealingTrace
    steps_run: int
    replicas: int
    converged_at_step: int
    total_tunneling_events: int

    def to_dict(self) -> dict:
        return {
            "solution_vector": self.x.astype(int).tolist(),
            "energy": round(self.energy, 6),
            "assignments": self.assignments,
            "trace": self.trace.to_dict(),
            "steps_run": self.steps_run,
            "replicas": self.replicas,
            "converged_at_step": self.converged_at_step,
            "total_tunneling_events": self.total_tunneling_events,
        }


class SimulatedQuantumAnnealer:
    """Path-integral SQA over P Trotter replicas with parallel tempering.

    Parameters
    ----------
    n_replicas : Trotter slices P. More slices resolve the imaginary-time path
        better at higher cost; 8-24 is the practical range.
    n_steps : annealing sweeps. Each sweep proposes n*P single-spin flips.
    gamma_max/gamma_min : transverse field schedule endpoints.
    t_max/t_min : temperature schedule endpoints.
    """

    def __init__(self, n_replicas: int = 12, n_steps: int = 400,
                 gamma_max: float = 3.0, gamma_min: float = 0.02,
                 t_max: float = 2.5, t_min: float = 0.05,
                 tunneling_cluster_size: int = 3, seed: int | None = None):
        self.n_replicas = max(2, n_replicas)
        self.n_steps = max(10, n_steps)
        self.gamma_max = gamma_max
        self.gamma_min = gamma_min
        self.t_max = t_max
        self.t_min = t_min
        self.tunneling_cluster_size = tunneling_cluster_size
        self.rng = np.random.default_rng(seed)

    # ---- schedules -------------------------------------------------------
    def temperature_at(self, step: int) -> float:
        """Quadratic cooling: T(t) = T_min + (T_max-T_min)*(1 - t/t_max)^2."""
        frac = step / max(self.n_steps - 1, 1)
        return self.t_min + (self.t_max - self.t_min) * (1.0 - frac) ** 2

    def transverse_field_at(self, step: int) -> float:
        """Linear decay of Gamma: full delocalisation to full localisation."""
        frac = step / max(self.n_steps - 1, 1)
        return self.gamma_min + (self.gamma_max - self.gamma_min) * (1.0 - frac)

    def coupling_at(self, gamma: float, temperature: float) -> float:
        """Trotter coupling J_perp from the path-integral mapping.

            J_perp = -(P / (2*beta)) * ln( tanh( beta*Gamma / P ) )

        Large Gamma gives weak coupling (replicas roam freely); as Gamma -> 0
        the coupling diverges and the replicas are forced into agreement.
        """
        beta = 1.0 / max(temperature, 1e-9)
        arg = beta * gamma / self.n_replicas
        tanh_arg = math.tanh(max(arg, 1e-12))
        if tanh_arg <= 0.0 or tanh_arg >= 1.0:
            return 50.0
        return min(50.0, -(self.n_replicas / (2.0 * beta)) * math.log(tanh_arg))

    # ---- energy deltas ---------------------------------------------------
    @staticmethod
    def _delta_problem_energy(Q: np.ndarray, x: np.ndarray, i: int) -> float:
        """Exact change in x^T Q x from flipping bit i, in O(n) not O(n^2)."""
        old = x[i]
        new = 1 - old
        delta_bit = new - old
        # d(x^T Q x) = delta * (Q_ii*delta + sum_{j!=i} (Q_ij + Q_ji) * x_j)
        cross = float(Q[i] @ x + x @ Q[:, i] - (Q[i, i] * x[i]) * 2.0)
        return delta_bit * cross + Q[i, i] * (new * new - old * old)

    def _delta_kinetic_energy(self, replicas: np.ndarray, r: int, i: int,
                              j_perp: float) -> float:
        """Change in the imaginary-time coupling term from flipping spin i in replica r.

        Replicas form a ring in the Trotter dimension; a flip that disagrees
        with both neighbours costs 2*J_perp, agreeing with both gains it.
        """
        P = self.n_replicas
        prev_r = (r - 1) % P
        next_r = (r + 1) % P
        # Map {0,1} to Ising {-1,+1} for the coupling term.
        s_old = 2 * replicas[r, i] - 1
        s_new = -s_old
        s_prev = 2 * replicas[prev_r, i] - 1
        s_next = 2 * replicas[next_r, i] - 1
        return -j_perp * (s_new - s_old) * (s_prev + s_next)

    # ---- main loop -------------------------------------------------------
    def solve(self, problem: QUBOProblem,
              progress_callback: Callable[[dict], None] | None = None,
              trace_every: int = 4) -> QUBOSolution:
        Q = problem.Q
        n = problem.n
        P = self.n_replicas

        # Initialise every replica independently -- a broad start in the
        # delocalised regime is what makes the anneal worth running.
        replicas = self.rng.integers(0, 2, size=(P, n)).astype(np.int8)
        replica_energies = np.array([problem.energy(replicas[r].astype(float)) for r in range(P)])

        best_idx = int(np.argmin(replica_energies))
        best_x = replicas[best_idx].copy()
        best_energy = float(replica_energies[best_idx])
        converged_at = 0

        trace = AnnealingTrace()
        total_tunneling = 0

        for step in range(self.n_steps):
            temperature = self.temperature_at(step)
            gamma = self.transverse_field_at(step)
            j_perp = self.coupling_at(gamma, temperature)
            beta = 1.0 / max(temperature, 1e-9)

            proposals = 0
            accepted = 0
            step_tunneling = 0

            # --- single-spin sweep across all replicas ---
            for r in range(P):
                x_r = replicas[r].astype(float)
                for _ in range(n):
                    i = int(self.rng.integers(0, n))
                    d_problem = self._delta_problem_energy(Q, x_r, i)
                    d_kinetic = self._delta_kinetic_energy(replicas, r, i, j_perp)
                    # Problem energy is shared across P slices in the path integral.
                    delta = d_problem / P + d_kinetic

                    proposals += 1
                    if delta <= 0.0 or self.rng.random() < math.exp(-min(700.0, beta * delta)):
                        x_r[i] = 1.0 - x_r[i]
                        replicas[r, i] = int(x_r[i])
                        replica_energies[r] += d_problem
                        accepted += 1

                # --- quantum tunnelling move: correlated multi-bit flip ---
                # Probability scales with the transverse field, so tunnelling is
                # common early (delocalised) and rare late (localised).
                tunnel_prob = min(0.9, gamma / max(self.gamma_max, 1e-9))
                if self.rng.random() < tunnel_prob:
                    k = int(self.rng.integers(2, self.tunneling_cluster_size + 1))
                    idx = self.rng.choice(n, size=min(k, n), replace=False)
                    trial = x_r.copy()
                    trial[idx] = 1.0 - trial[idx]
                    e_trial = problem.energy(trial)
                    d_cluster = e_trial - replica_energies[r]
                    # Tunnelling accepts barrier-crossing moves that a single-flip
                    # chain at this temperature would essentially never make.
                    if d_cluster <= 0.0 or self.rng.random() < math.exp(-min(700.0, beta * d_cluster / P)):
                        x_r = trial
                        replicas[r] = trial.astype(np.int8)
                        replica_energies[r] = e_trial
                        step_tunneling += 1

            total_tunneling += step_tunneling

            # --- parallel tempering: swap adjacent replicas ---
            # Replicas sit at effectively different temperatures through their
            # position in the Trotter ring; swapping lets a stuck low-energy
            # replica borrow a hot replica's mobility.
            for r in range(P - 1):
                d_e = replica_energies[r] - replica_energies[r + 1]
                if d_e > 0 or self.rng.random() < math.exp(-min(700.0, beta * abs(d_e) * 0.1)):
                    replicas[[r, r + 1]] = replicas[[r + 1, r]]
                    replica_energies[[r, r + 1]] = replica_energies[[r + 1, r]]

            step_best_idx = int(np.argmin(replica_energies))
            if replica_energies[step_best_idx] < best_energy - 1e-12:
                best_energy = float(replica_energies[step_best_idx])
                best_x = replicas[step_best_idx].copy()
                converged_at = step

            if step % trace_every == 0 or step == self.n_steps - 1:
                trace.step.append(step)
                trace.temperature.append(temperature)
                trace.transverse_field.append(gamma)
                trace.best_energy.append(best_energy)
                trace.mean_energy.append(float(np.mean(replica_energies)))
                trace.acceptance_rate.append(accepted / max(proposals, 1))
                trace.tunneling_events.append(step_tunneling)

                if progress_callback is not None:
                    progress_callback({
                        "phase": "qubo",
                        "step": step,
                        "total_steps": self.n_steps,
                        "progress": (step + 1) / self.n_steps,
                        "temperature": round(temperature, 5),
                        "transverse_field": round(gamma, 5),
                        "best_energy": round(best_energy, 5),
                        "mean_energy": round(float(np.mean(replica_energies)), 5),
                        "acceptance_rate": round(accepted / max(proposals, 1), 5),
                        "tunneling_events": step_tunneling,
                    })

        x_final = best_x.astype(float)
        return QUBOSolution(
            x=x_final,
            energy=problem.energy(x_final),
            assignments=problem.decode(x_final),
            trace=trace,
            steps_run=self.n_steps,
            replicas=P,
            converged_at_step=converged_at,
            total_tunneling_events=total_tunneling,
        )
