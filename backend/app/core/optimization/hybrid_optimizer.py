"""Two-stage hybrid optimiser: QUBO for discrete, QPSO for continuous.

    Stage 1 (QUBO / Simulated Quantum Annealing)
        Which vessel sails which route, on which fuel, drawing shore power where.
        Discrete, combinatorial, constraint-heavy.

    Stage 2 (QPSO)
        Given that assignment, the speed for every leg of every voyage.
        Continuous, bounded, multimodal, no useful gradient.

Forcing both halves into one framework is the standard compromise and it is a
poor one: MILP has to discretise the speeds, and a genetic algorithm has to
repair constraint violations it constantly generates. Splitting them lets each
solver work on the structure it is actually built for.

The whole pair runs once per weight vector; sweeping the weights and collecting
non-dominated results traces the Pareto front.
"""

from __future__ import annotations

import time
from typing import Callable

import numpy as np

from ..compliance.cii_calculator import calculate_cii
from ..emissions.shore_power import evaluate_shore_power, get_port
from ..emissions.wtw_calculator import compute_emissions
from ..physics.propulsion import integrate_voyage_energy
from ..physics.weather import generate_route_weather
from .constraints import build_fleet_qubo, crowding_distance, non_dominated_sort
from .objectives import (
    OBJECTIVE_LABELS,
    OBJECTIVE_NAMES,
    build_legs,
    evaluate_solution,
    generate_weight_vectors,
    normalize_objectives,
)
from .qpso_solver import QPSO
from .qubo_solver import SimulatedQuantumAnnealer

ProgressFn = Callable[[dict], None] | None


class HybridOptimizer:
    """Orchestrates the QUBO -> QPSO pipeline across a weight sweep."""

    def __init__(self, vessels: list[dict], routes: list[dict],
                 year: int = 2026, month: int = 7,
                 uncertainty_lambda: float = 1.0,
                 qubo_steps: int = 220, qubo_replicas: int = 8,
                 qpso_particles: int = 24, qpso_iterations: int = 90,
                 seed: int | None = 42):
        self.vessels = vessels
        self.routes = routes
        self.year = year
        self.month = month
        self.uncertainty_lambda = uncertainty_lambda
        self.qubo_steps = qubo_steps
        self.qubo_replicas = qubo_replicas
        self.qpso_particles = qpso_particles
        self.qpso_iterations = qpso_iterations
        self.seed = seed

        # Weather is drawn once and held fixed across the sweep, so every
        # candidate on the front is compared under identical conditions.
        self.weather: dict[str, list[dict]] = {
            r["id"]: generate_route_weather(r, month=month) for r in routes
        }
        self._eval_cache: dict[tuple, tuple] = {}

    # -- stage 1 support ---------------------------------------------------
    def _service_speed_estimate(self, vessel: dict, route: dict, fuel_id: str) -> dict:
        """Cheap evaluation at service speed, used to price the QUBO diagonal.

        The QUBO needs a cost per (vessel, route, fuel) before speeds are known.
        Service speed is the honest proxy: it is what the ship would do absent
        optimisation, so the QUBO chooses assignments and QPSO then improves them.
        """
        key = (vessel["id"], route["id"], fuel_id)
        if key in self._eval_cache:
            return self._eval_cache[key][0]

        n_legs = max(1, len(route["waypoints"]) - 1)
        speeds = np.full(n_legs, float(vessel["speed_service_kn"]))
        objectives, detail = evaluate_solution(
            vessel, route, fuel_id, speeds, self.weather[route["id"]],
            year=self.year, uncertainty_lambda=self.uncertainty_lambda,
        )
        record = {
            "fuel_cost_usd": objectives.fuel_cost_usd,
            "ghg_wtw_t": objectives.ghg_wtw_t,
            "delay_hours": objectives.delay_hours,
            "compliance_risk": objectives.compliance_risk,
            "cii_rating": objectives.cii_rating,
            "cii_compliant": objectives.cii_compliant,
            "duration_hours": objectives.duration_hours,
        }
        self._eval_cache[key] = (record, detail)
        return record

    def _shore_power_matrix(self) -> dict:
        """Shore power evaluation for every vessel at every port it could call."""
        matrix: dict[str, dict] = {}
        port_ids = {r["origin_port"] for r in self.routes} | {r["destination_port"] for r in self.routes}
        for vessel in self.vessels:
            entries: dict[str, dict] = {}
            for port_id in sorted(port_ids):
                result = evaluate_shore_power(vessel, port_id, berth_hours=30.0)
                # Benefit combines the money saved and the carbon avoided,
                # priced at a notional carbon value so both land in one number.
                carbon_price = 95.0  # USD/t CO2e, EU ETS maritime indicative
                result["objective_benefit"] = (
                    result["cost_saving_usd"] + carbon_price * result["ghg_saving_wtw_t"]
                )
                entries[port_id] = result
            matrix[vessel["id"]] = entries
        return matrix

    def _build_matrices(self, weights: np.ndarray, fuels: list[str],
                        scales: dict) -> tuple[dict, dict]:
        """Cost and CII-penalty matrices for the QUBO diagonal under one weight vector."""
        cost_matrix: dict = {}
        cii_matrix: dict = {}
        for vessel in self.vessels:
            for route in self.routes:
                for fuel_id in fuels:
                    if fuel_id not in vessel.get("compatible_fuels", []):
                        continue
                    rec = self._service_speed_estimate(vessel, route, fuel_id)
                    # Scalarise with the same weights the QPSO stage will use,
                    # so both stages optimise a consistent preference.
                    scalar = (
                        weights[0] * rec["fuel_cost_usd"] / scales["fuel_cost"]
                        + weights[1] * rec["ghg_wtw_t"] / scales["ghg_wtw"]
                        + weights[2] * rec["delay_hours"] / scales["delay"]
                        + weights[3] * rec["compliance_risk"] / scales["compliance_risk"]
                        + weights[4] * rec["fuel_cost_usd"] / scales["fuel_cost"]
                    )
                    cost_matrix[(vessel["id"], route["id"], fuel_id)] = scalar * 100.0
                    # A non-compliant pairing is penalised inside the QUBO, which
                    # is the whole "compliance in the loop" claim: the optimizer
                    # cannot return a plan that breaches CII.
                    cii_matrix[(vessel["id"], route["id"], fuel_id)] = (
                        0.0 if rec["cii_compliant"] else 2.5 + 3.0 * rec["compliance_risk"]
                    )
        return cost_matrix, cii_matrix

    def _objective_scales(self, fuels: list[str]) -> dict:
        """Reference magnitudes so the five objectives are commensurate."""
        costs, ghgs, delays, risks = [], [], [], []
        for vessel in self.vessels:
            for route in self.routes:
                for fuel_id in fuels:
                    if fuel_id not in vessel.get("compatible_fuels", []):
                        continue
                    rec = self._service_speed_estimate(vessel, route, fuel_id)
                    costs.append(rec["fuel_cost_usd"])
                    ghgs.append(rec["ghg_wtw_t"])
                    delays.append(rec["delay_hours"])
                    risks.append(rec["compliance_risk"])
        return {
            "fuel_cost": max(max(costs, default=1.0), 1.0),
            "ghg_wtw": max(max(ghgs, default=1.0), 1.0),
            "delay": max(max(delays, default=1.0), 1.0),
            "compliance_risk": max(max(risks, default=1.0), 0.01),
        }

    # -- stage 2 -----------------------------------------------------------
    def _optimize_speeds(self, vessel: dict, route: dict, fuel_id: str,
                         weights: np.ndarray, scales: dict,
                         shore_power_result: dict | None,
                         progress: ProgressFn = None,
                         progress_base: float = 0.0,
                         progress_span: float = 0.0) -> tuple[np.ndarray, dict, dict]:
        """QPSO over the per-leg speed vector for one assigned voyage."""
        n_legs = max(1, len(route["waypoints"]) - 1)
        lower = np.full(n_legs, float(vessel["speed_min_kn"]))
        upper = np.full(n_legs, float(vessel["speed_max_kn"]))
        weather = self.weather[route["id"]]

        def objective(speeds: np.ndarray) -> float:
            obj, _ = evaluate_solution(
                vessel, route, fuel_id, speeds, weather,
                year=self.year, uncertainty_lambda=self.uncertainty_lambda,
                shore_power=bool(shore_power_result and shore_power_result.get("recommended")),
                shore_power_result=shore_power_result,
            )
            return (
                weights[0] * obj.fuel_cost_usd / scales["fuel_cost"]
                + weights[1] * obj.ghg_wtw_t / scales["ghg_wtw"]
                + weights[2] * obj.delay_hours / scales["delay"]
                + weights[3] * obj.compliance_risk / scales["compliance_risk"]
                + weights[4] * obj.risk_adjusted_fuel_t / max(scales["fuel_cost"] / 600.0, 1e-6)
            )

        qpso = QPSO(n_particles=self.qpso_particles, n_iterations=self.qpso_iterations,
                    seed=self.seed)
        def qpso_progress(event: dict) -> None:
            # The swarm reports its own 0-1 progress; rescale it into this
            # voyage's slice of the run so the global bar stays monotonic.
            self._emit(progress, {
                **event,
                "progress": progress_base + progress_span * event.get("progress", 0.0),
            })

        solution = qpso.optimize(
            objective, lower, upper,
            progress_callback=qpso_progress if progress is not None else None,
            initial_guess=np.full(n_legs, float(vessel["speed_service_kn"])),
        )

        obj, detail = evaluate_solution(
            vessel, route, fuel_id, solution.x, weather,
            year=self.year, uncertainty_lambda=self.uncertainty_lambda,
            shore_power=bool(shore_power_result and shore_power_result.get("recommended")),
            shore_power_result=shore_power_result,
        )
        detail["qpso"] = solution.to_dict()
        return solution.x, obj.to_dict(), detail

    # -- orchestration -----------------------------------------------------
    def run(self, fuels: list[str] | None = None, n_solutions: int = 12,
            progress: ProgressFn = None) -> dict:
        """Full sweep: build the front and return it with all supporting detail."""
        started = time.time()

        if fuels is None:
            fuels = sorted({f for v in self.vessels for f in v.get("compatible_fuels", [])})

        self._emit(progress, {"phase": "setup", "progress": 0.02,
                              "message": "Evaluating vessel-route-fuel feasibility"})

        scales = self._objective_scales(fuels)
        shore_matrix = self._shore_power_matrix()
        weight_vectors = generate_weight_vectors(5, n_solutions, seed=self.seed)

        candidates: list[dict] = []
        total = len(weight_vectors)

        for w_idx, weights in enumerate(weight_vectors):
            base_progress = 0.05 + 0.90 * (w_idx / max(total, 1))
            self._emit(progress, {
                "phase": "qubo", "progress": base_progress,
                "scenario": w_idx + 1, "total_scenarios": total,
                "weights": {name: round(float(weights[i]), 4)
                            for i, name in enumerate(OBJECTIVE_NAMES)},
                "message": f"Scenario {w_idx + 1}/{total}: annealing fleet assignment",
            })

            cost_matrix, cii_matrix = self._build_matrices(weights, fuels, scales)
            problem = build_fleet_qubo(self.vessels, self.routes, fuels,
                                       cost_matrix, cii_matrix, shore_matrix)

            annealer = SimulatedQuantumAnnealer(
                n_replicas=self.qubo_replicas, n_steps=self.qubo_steps,
                seed=None if self.seed is None else self.seed + w_idx,
            )
            # Forward the annealer's own telemetry, not just a scenario counter.
            # The temperature and transverse-field schedule is what the UI plots
            # to show the anneal is real, and without this callback the chart
            # receives nothing but the coarse per-scenario progress ticks.
            def qubo_progress(event: dict, _idx: int = w_idx) -> None:
                self._emit(progress, {
                    **event,
                    "scenario": _idx + 1,
                    "total_scenarios": total,
                    # Keep the global bar monotonic across scenarios rather than
                    # letting each anneal reset it to zero.
                    "progress": base_progress + (0.45 * event.get("progress", 0.0)) / max(total, 1),
                })

            qubo_solution = annealer.solve(problem, progress_callback=qubo_progress)

            assignments = [a for a in qubo_solution.assignments if a.get("type") == "assignment"]
            shore_choices = {a["vessel_id"]: a["port_id"]
                             for a in qubo_solution.assignments if a.get("type") == "shore_power"}
            if not assignments:
                continue

            self._emit(progress, {
                "phase": "qpso", "progress": base_progress + 0.45 / max(total, 1),
                "scenario": w_idx + 1, "total_scenarios": total,
                "assignments": len(assignments),
                "qubo_energy": round(qubo_solution.energy, 4),
                "message": f"Scenario {w_idx + 1}/{total}: optimising speed profiles",
            })

            voyages = []
            totals = {"fuel_cost_usd": 0.0, "ghg_wtw_t": 0.0, "ghg_ttw_t": 0.0,
                      "co2_ttw_t": 0.0, "delay_hours": 0.0, "compliance_risk": 0.0,
                      "risk_adjusted_fuel_t": 0.0, "fuel_mass_t": 0.0,
                      "duration_hours": 0.0, "distance_nm": 0.0}

            vessel_by_id = {v["id"]: v for v in self.vessels}
            route_by_id = {r["id"]: r for r in self.routes}

            for voyage_index, assignment in enumerate(assignments):
                vessel = vessel_by_id[assignment["vessel_id"]]
                route = route_by_id[assignment["route_id"]]
                fuel_id = assignment["fuel_id"]

                port_id = shore_choices.get(vessel["id"], route["destination_port"])
                sp_result = shore_matrix.get(vessel["id"], {}).get(port_id)
                sp_selected = vessel["id"] in shore_choices

                # Split the scenario's second half evenly across its voyages.
                voyage_span = (0.45 / max(total, 1)) / max(len(assignments), 1)
                speeds, obj_dict, detail = self._optimize_speeds(
                    vessel, route, fuel_id, weights, scales,
                    sp_result if sp_selected else sp_result,
                    progress=progress,
                    progress_base=base_progress + 0.45 / max(total, 1) + voyage_index * voyage_span,
                    progress_span=voyage_span,
                )

                voyages.append({
                    "vessel_id": vessel["id"], "vessel_name": vessel["name"],
                    "ship_type": vessel["ship_type"], "dwt": vessel["dwt"],
                    "route_id": route["id"], "route_name": route["name"],
                    "route_waypoints": route["waypoints"],
                    "distance_nm": route["distance_nm"],
                    "fuel_id": fuel_id,
                    "shore_power": {
                        "selected": sp_selected,
                        "port_id": port_id,
                        "detail": sp_result,
                    },
                    "speeds_kn": [round(float(s), 3) for s in speeds],
                    "objectives": obj_dict,
                    "speed_profile": detail["speed_profile"],
                    "cii": detail["cii"],
                    "emissions": detail["emissions"],
                    "qpso_trace": detail["qpso"]["trace"],
                    "voyage_totals": {
                        "total_duration_hours": detail["voyage"]["total_duration_hours"],
                        "total_distance_nm": detail["voyage"]["total_distance_nm"],
                        "average_speed_kn": detail["voyage"]["average_speed_kn"],
                        "average_power_kw": detail["voyage"]["average_power_kw"],
                        "total_energy_mj": detail["voyage"]["total_energy_mj"],
                    },
                })

                totals["fuel_cost_usd"] += obj_dict["fuel_cost_usd"]
                totals["ghg_wtw_t"] += obj_dict["ghg_wtw_t"]
                totals["ghg_ttw_t"] += obj_dict["ghg_ttw_t"]
                totals["co2_ttw_t"] += obj_dict["co2_ttw_t"]
                totals["delay_hours"] += obj_dict["delay_hours"]
                totals["compliance_risk"] = max(totals["compliance_risk"], obj_dict["compliance_risk"])
                totals["risk_adjusted_fuel_t"] += obj_dict["risk_adjusted_fuel_t"]
                totals["fuel_mass_t"] += obj_dict["fuel_mass_t"]
                totals["duration_hours"] = max(totals["duration_hours"], obj_dict["duration_hours"])
                totals["distance_nm"] += route["distance_nm"]

            candidates.append({
                "scenario_index": w_idx,
                "weights": {name: round(float(weights[i]), 4)
                            for i, name in enumerate(OBJECTIVE_NAMES)},
                "qubo": {
                    "energy": round(qubo_solution.energy, 6),
                    "trace": qubo_solution.trace.to_dict(),
                    "steps_run": qubo_solution.steps_run,
                    "replicas": qubo_solution.replicas,
                    "converged_at_step": qubo_solution.converged_at_step,
                    "tunneling_events": qubo_solution.total_tunneling_events,
                    "n_variables": problem.n,
                },
                "voyages": voyages,
                "totals": totals,
                "all_compliant": all(v["objectives"]["cii_compliant"] for v in voyages),
            })

        self._emit(progress, {"phase": "pareto", "progress": 0.96,
                              "message": "Computing Pareto front"})

        result = self._assemble_front(candidates)
        result["runtime_seconds"] = round(time.time() - started, 3)
        result["configuration"] = {
            "year": self.year, "month": self.month,
            "uncertainty_lambda": self.uncertainty_lambda,
            "qubo_steps": self.qubo_steps, "qubo_replicas": self.qubo_replicas,
            "qpso_particles": self.qpso_particles, "qpso_iterations": self.qpso_iterations,
            "fuels_considered": fuels,
            "n_vessels": len(self.vessels), "n_routes": len(self.routes),
        }
        result["weather"] = self.weather

        self._emit(progress, {"phase": "complete", "progress": 1.0,
                              "message": f"{len(result['pareto_solutions'])} Pareto-optimal plans found"})
        return result

    def _assemble_front(self, candidates: list[dict]) -> dict:
        if not candidates:
            return {"pareto_solutions": [], "all_solutions": [], "objective_names": OBJECTIVE_NAMES}

        matrix = np.array([[
            c["totals"]["fuel_cost_usd"],
            c["totals"]["ghg_wtw_t"],
            c["totals"]["delay_hours"],
            c["totals"]["compliance_risk"],
            c["totals"]["risk_adjusted_fuel_t"],
        ] for c in candidates])

        fronts = non_dominated_sort(matrix)
        normalized = normalize_objectives(matrix)

        for rank, front in enumerate(fronts):
            distances = crowding_distance(matrix, front)
            for pos, idx in enumerate(front):
                candidates[idx]["pareto_rank"] = rank
                candidates[idx]["is_pareto_optimal"] = (rank == 0)
                candidates[idx]["crowding_distance"] = (
                    None if not np.isfinite(distances[pos]) else round(float(distances[pos]), 6)
                )
                candidates[idx]["normalized_objectives"] = {
                    name: round(float(normalized[idx][i]), 6)
                    for i, name in enumerate(OBJECTIVE_NAMES)
                }

        pareto = [c for c in candidates if c.get("is_pareto_optimal")]
        pareto.sort(key=lambda c: c["totals"]["fuel_cost_usd"])

        for i, c in enumerate(pareto):
            c["solution_id"] = f"S{i + 1}"
            c["label"] = self._label_solution(c)

        # Business-as-usual reference: the worst non-dominated plan on each axis
        # separately. Comparing "greenest" against the dirtiest achievable plan
        # is the honest saving figure; comparing it against itself is not.
        best_cost = min(pareto, key=lambda c: c["totals"]["fuel_cost_usd"]) if pareto else None
        best_ghg = min(pareto, key=lambda c: c["totals"]["ghg_wtw_t"]) if pareto else None
        worst_cost = max(candidates, key=lambda c: c["totals"]["fuel_cost_usd"])
        worst_ghg = max(candidates, key=lambda c: c["totals"]["ghg_wtw_t"])

        return {
            "pareto_solutions": pareto,
            "all_solutions": candidates,
            "objective_names": OBJECTIVE_NAMES,
            "objective_labels": OBJECTIVE_LABELS,
            "n_evaluated": len(candidates),
            "n_pareto_optimal": len(pareto),
            "front_summary": {
                "min_fuel_cost_usd": float(matrix[:, 0].min()),
                "max_fuel_cost_usd": float(matrix[:, 0].max()),
                "min_ghg_wtw_t": float(matrix[:, 1].min()),
                "max_ghg_wtw_t": float(matrix[:, 1].max()),
                "baseline_cost_usd": worst_cost["totals"]["fuel_cost_usd"],
                "baseline_ghg_t": worst_ghg["totals"]["ghg_wtw_t"],
                "best_cost_usd": best_cost["totals"]["fuel_cost_usd"] if best_cost else None,
                "best_ghg_t": best_ghg["totals"]["ghg_wtw_t"] if best_ghg else None,
                "cost_saving_usd": (worst_cost["totals"]["fuel_cost_usd"] - best_cost["totals"]["fuel_cost_usd"]) if best_cost else 0.0,
                "cost_saving_pct": round((worst_cost["totals"]["fuel_cost_usd"] - best_cost["totals"]["fuel_cost_usd"]) / max(worst_cost["totals"]["fuel_cost_usd"], 1e-9) * 100.0, 2) if best_cost else 0.0,
                "ghg_saving_t": (worst_ghg["totals"]["ghg_wtw_t"] - best_ghg["totals"]["ghg_wtw_t"]) if best_ghg else 0.0,
                "ghg_saving_pct": round((worst_ghg["totals"]["ghg_wtw_t"] - best_ghg["totals"]["ghg_wtw_t"]) / max(worst_ghg["totals"]["ghg_wtw_t"], 1e-9) * 100.0, 2) if best_ghg else 0.0,
            },
        }

    @staticmethod
    def _label_solution(candidate: dict) -> str:
        """Name a solution by whichever objective its weights emphasise."""
        weights = candidate["weights"]
        dominant = max(weights, key=weights.get)
        if weights[dominant] < 0.35:
            return "Balanced"
        return {
            "fuel_cost": "Lowest Cost",
            "ghg_wtw": "Greenest",
            "delay": "Fastest",
            "compliance_risk": "Safest Compliance",
            "risk_adjusted_fuel": "Most Robust",
        }.get(dominant, "Balanced")

    @staticmethod
    def _emit(progress: ProgressFn, payload: dict) -> None:
        if progress is not None:
            progress(payload)
