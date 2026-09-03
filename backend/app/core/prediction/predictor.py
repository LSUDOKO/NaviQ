"""Inference wrapper with a physics fallback and uncertainty quantification.

Two prediction paths, both live:

    neural   The trained BiLSTM. Fast, learns residual effects the analytic
             model misses, and reports epistemic uncertainty via MC Dropout.
    physics  The Holtrop-Mennen chain run directly. Always available, needs no
             weights, and is what the neural path is validated against.

The service prefers the neural path when weights are present and falls back
otherwise, so the API behaves identically whether or not the model is trained.
Both report a physics breakdown, because "the fuel number" is far less useful
to an operator than "the fuel number, and that 40% of it is wave resistance".
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from ..physics.fuel_conversion import get_fuel
from ..physics.propulsion import compute_propulsion, integrate_voyage_energy
from .data_processor import FeatureScaler, build_sequence

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
WEIGHTS_PATH = DATA_DIR / "model_weights.pt"


class FuelPredictor:
    """Predicts voyage fuel with decomposed uncertainty."""

    def __init__(self, prefer_neural: bool = True):
        self.model = None
        self.scaler: FeatureScaler | None = None
        self.y_mean = 0.0
        self.y_std = 1.0
        self.mode = "physics"
        self.metrics: dict = {}

        if prefer_neural:
            self._try_load_neural()

        metrics_path = DATA_DIR / "model_metrics.json"
        if metrics_path.exists():
            with open(metrics_path) as fh:
                payload = json.load(fh)
            self.metrics = {k: v for k, v in payload.items() if k != "history"}

    def _try_load_neural(self) -> None:
        if not WEIGHTS_PATH.exists():
            return
        try:
            import torch
            from .model import FuelPredictionNet

            checkpoint = torch.load(WEIGHTS_PATH, map_location="cpu", weights_only=False)
            model = FuelPredictionNet()
            model.load_state_dict(checkpoint["state_dict"])
            model.eval()

            self.model = model
            self.scaler = FeatureScaler.from_dict(checkpoint["feature_scaler"])
            self.y_mean = float(checkpoint["y_mean"])
            self.y_std = float(checkpoint["y_std"])
            self.mode = "neural"
        except Exception:
            # Any load failure silently leaves the physics path in place; the
            # API stays up rather than 500-ing on a missing or stale checkpoint.
            self.model = None
            self.mode = "physics"

    # -- physics path ------------------------------------------------------
    def predict_physics(self, vessel: dict, legs: list[dict], fuel_id: str) -> dict:
        """Analytic prediction straight from the resistance chain."""
        voyage = integrate_voyage_energy(vessel, legs)
        fuel = get_fuel(fuel_id)
        energy_mj = voyage["total_energy_mj"]
        mass_t = energy_mj / (float(fuel["lhv_mj_per_kg"]) * float(fuel["engine_efficiency"])) / 1000.0

        per_leg = []
        for i, leg_result in enumerate(voyage["legs"]):
            leg_mass = leg_result["energy_mj"] / (
                float(fuel["lhv_mj_per_kg"]) * float(fuel["engine_efficiency"])
            ) / 1000.0
            per_leg.append({
                "leg": i,
                "distance_nm": round(leg_result["distance_nm"], 2),
                "speed_kn": round(leg_result["speed_kn"], 2),
                "duration_hours": round(leg_result["duration_hours"], 3),
                "fuel_tonnes": round(leg_mass, 4),
                "fuel_rate_kg_per_h": round(leg_mass * 1000.0 / max(leg_result["duration_hours"], 1e-6), 2),
                "shaft_power_kw": round(leg_result["shaft_power_kw"], 1),
                "engine_load_pct": round(leg_result["engine_load_pct"], 1),
                "resistance": leg_result["resistance"],
            })

        return {
            "mode": "physics",
            "fuel_tonnes": mass_t,
            "energy_mj": energy_mj,
            "duration_hours": voyage["total_duration_hours"],
            "distance_nm": voyage["total_distance_nm"],
            "average_power_kw": voyage["average_power_kw"],
            "per_leg": per_leg,
            "physics_breakdown": self._aggregate_resistance(voyage),
        }

    # -- neural path -------------------------------------------------------
    def predict_neural(self, vessel: dict, legs: list[dict], fuel_id: str,
                       n_samples: int = 40) -> dict | None:
        """MC-Dropout prediction. Returns None if the neural path is unavailable."""
        if self.model is None or self.scaler is None:
            return None
        import torch

        speeds = [float(leg["speed_kn"]) for leg in legs]
        weather = [leg.get("weather", {}) for leg in legs]
        sequence = build_sequence(vessel, speeds, weather)
        if sequence.shape[0] == 0:
            return None

        scaled = self.scaler.transform(sequence[None, :, :])
        x = torch.tensor(scaled, dtype=torch.float32)

        result = self.model.predict_with_uncertainty(x, n_samples=n_samples)

        # Undo the log-space standardisation. For a lognormal, the mean of the
        # variable is exp(mu + sigma^2/2), not exp(mu) -- using exp(mu) alone
        # would systematically under-report fuel.
        mu_log = result["mean"][0].numpy() * self.y_std + self.y_mean
        sigma_log = result["total_std"][0].numpy() * self.y_std
        epi_log = result["epistemic_std"][0].numpy() * self.y_std
        alea_log = result["aleatoric_std"][0].numpy() * self.y_std

        rate_mean = np.exp(mu_log + 0.5 * sigma_log ** 2)
        rate_std = rate_mean * np.sqrt(np.maximum(np.exp(sigma_log ** 2) - 1.0, 0.0))
        epi_std = rate_mean * np.sqrt(np.maximum(np.exp(epi_log ** 2) - 1.0, 0.0))
        alea_std = rate_mean * np.sqrt(np.maximum(np.exp(alea_log ** 2) - 1.0, 0.0))

        durations = np.array([float(leg["distance_nm"]) / max(float(leg["speed_kn"]), 1e-6)
                              for leg in legs])
        n = min(len(durations), len(rate_mean))

        leg_fuel_t = rate_mean[:n] * durations[:n] / 1000.0
        leg_sigma_t = rate_std[:n] * durations[:n] / 1000.0

        total_fuel_t = float(leg_fuel_t.sum())
        # Leg errors are correlated through shared weather, so add in quadrature
        # with a correlation term rather than assuming independence.
        rho = 0.45
        total_var = float((leg_sigma_t ** 2).sum())
        for i in range(n):
            for j in range(i + 1, n):
                total_var += 2.0 * rho * leg_sigma_t[i] * leg_sigma_t[j]
        total_sigma_t = math.sqrt(max(total_var, 0.0))

        per_leg = [{
            "leg": i,
            "distance_nm": round(float(legs[i]["distance_nm"]), 2),
            "speed_kn": round(float(legs[i]["speed_kn"]), 2),
            "duration_hours": round(float(durations[i]), 3),
            "fuel_rate_kg_per_h": round(float(rate_mean[i]), 2),
            "fuel_rate_std_kg_per_h": round(float(rate_std[i]), 2),
            "epistemic_std_kg_per_h": round(float(epi_std[i]), 3),
            "aleatoric_std_kg_per_h": round(float(alea_std[i]), 3),
            "fuel_tonnes": round(float(leg_fuel_t[i]), 4),
        } for i in range(n)]

        return {
            "mode": "neural",
            "fuel_tonnes": total_fuel_t,
            "fuel_tonnes_std": total_sigma_t,
            "confidence_interval_95": [
                max(0.0, total_fuel_t - 1.96 * total_sigma_t),
                total_fuel_t + 1.96 * total_sigma_t,
            ],
            "epistemic_fraction": float(np.mean(epi_std) / max(np.mean(rate_std), 1e-9)),
            "mc_samples": n_samples,
            "per_leg": per_leg,
        }

    # -- combined ----------------------------------------------------------
    def predict(self, vessel: dict, legs: list[dict], fuel_id: str,
                n_samples: int = 40) -> dict:
        """Predict fuel, preferring the neural path and always reporting physics.

        Both estimates are returned. Their agreement is itself a diagnostic: a
        large divergence means the network is extrapolating away from what the
        physics supports, and the operator should trust the analytic number.
        """
        physics = self.predict_physics(vessel, legs, fuel_id)
        neural = self.predict_neural(vessel, legs, fuel_id, n_samples) if self.model else None

        if neural is not None:
            primary = neural
            fuel_t = neural["fuel_tonnes"]
            sigma_t = neural["fuel_tonnes_std"]
            divergence = abs(fuel_t - physics["fuel_tonnes"]) / max(physics["fuel_tonnes"], 1e-9)
        else:
            primary = physics
            fuel_t = physics["fuel_tonnes"]
            # Without a learned variance, uncertainty comes from sea state.
            sigma_fraction = self._weather_sigma(legs)
            sigma_t = fuel_t * sigma_fraction
            divergence = 0.0

        fuel = get_fuel(fuel_id)
        return {
            "mode": primary["mode"],
            "fuel_tonnes": round(fuel_t, 4),
            "fuel_tonnes_std": round(sigma_t, 4),
            "confidence_interval_95": [
                round(max(0.0, fuel_t - 1.96 * sigma_t), 4),
                round(fuel_t + 1.96 * sigma_t, 4),
            ],
            "confidence_interval_68": [
                round(max(0.0, fuel_t - sigma_t), 4),
                round(fuel_t + sigma_t, 4),
            ],
            "fuel_cost_usd": round(fuel_t * float(fuel["price_usd_per_tonne"]), 2),
            "energy_mj": round(physics["energy_mj"], 2),
            "duration_hours": round(physics["duration_hours"], 3),
            "distance_nm": round(physics["distance_nm"], 2),
            "average_power_kw": round(physics["average_power_kw"], 1),
            "physics_breakdown": physics["physics_breakdown"],
            "per_leg": primary["per_leg"],
            "physics_estimate_tonnes": round(physics["fuel_tonnes"], 4),
            "neural_estimate_tonnes": round(neural["fuel_tonnes"], 4) if neural else None,
            "model_divergence_pct": round(divergence * 100.0, 3),
            "epistemic_fraction": round(neural["epistemic_fraction"], 4) if neural else None,
            "model_info": {
                "mode": self.mode,
                "validation_mape_pct": self.metrics.get("final_val_mape_pct"),
                "validation_mae_kg_per_h": self.metrics.get("final_val_mae_kg_per_h"),
                "parameters": self.metrics.get("parameters"),
            },
        }

    @staticmethod
    def _aggregate_resistance(voyage: dict) -> dict:
        """Resistance components averaged over the voyage, weighted by leg energy."""
        total_energy = max(voyage["total_energy_mj"], 1e-9)
        components = {"r_calm_kn": 0.0, "r_wind_kn": 0.0, "r_wave_kn": 0.0,
                      "r_friction_kn": 0.0, "r_residuary_kn": 0.0}
        for leg in voyage["legs"]:
            weight = leg["energy_mj"] / total_energy
            for key in components:
                components[key] += leg["resistance"][key] * weight

        total = components["r_calm_kn"] + max(components["r_wind_kn"], 0.0) + components["r_wave_kn"]
        total = max(total, 1e-9)
        return {
            "calm_water_kn": round(components["r_calm_kn"], 2),
            "friction_kn": round(components["r_friction_kn"], 2),
            "residuary_kn": round(components["r_residuary_kn"], 2),
            "wind_kn": round(components["r_wind_kn"], 2),
            "wave_kn": round(components["r_wave_kn"], 2),
            "total_kn": round(total, 2),
            "shares_pct": {
                "friction": round(components["r_friction_kn"] / total * 100.0, 2),
                "residuary": round(components["r_residuary_kn"] / total * 100.0, 2),
                "wind": round(max(components["r_wind_kn"], 0.0) / total * 100.0, 2),
                "wave": round(components["r_wave_kn"] / total * 100.0, 2),
            },
        }

    @staticmethod
    def _weather_sigma(legs: list[dict]) -> float:
        waves = [float(leg.get("weather", {}).get("wave_height_m", 1.0)) for leg in legs]
        if not waves:
            return 0.05
        return min(0.35, 0.04 + 0.035 * float(np.mean(waves)) + 0.04 * float(np.std(waves)))


_predictor: FuelPredictor | None = None


def get_predictor() -> FuelPredictor:
    """Process-wide singleton: the weights load once, not per request."""
    global _predictor
    if _predictor is None:
        _predictor = FuelPredictor()
    return _predictor
