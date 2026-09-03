"""Feature engineering and normalisation for the sequence model.

Two details matter more than they look:

* Circular encoding. A heading of 359 degrees and one of 1 degree are two
  degrees apart, but numerically 358 apart. Every angle is therefore split into
  its sine and cosine so the network sees the true geometry.

* Per-feature standardisation. Draft in metres and DWT in tonnes differ by four
  orders of magnitude; without scaling the LSTM gates saturate on the large
  columns and never learn from the small ones.
"""

from __future__ import annotations

import math

import numpy as np

from .model import FEATURE_NAMES


class FeatureScaler:
    """Standardises features to zero mean and unit variance, with persistence."""

    def __init__(self, mean: np.ndarray | None = None, std: np.ndarray | None = None):
        self.mean = mean
        self.std = std

    def fit(self, X: np.ndarray) -> "FeatureScaler":
        flat = X.reshape(-1, X.shape[-1])
        self.mean = flat.mean(axis=0)
        self.std = flat.std(axis=0)
        self.std[self.std < 1e-8] = 1.0
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        if self.mean is None or self.std is None:
            raise RuntimeError("Scaler must be fitted before transform.")
        return (X - self.mean) / self.std

    def fit_transform(self, X: np.ndarray) -> np.ndarray:
        return self.fit(X).transform(X)

    def to_dict(self) -> dict:
        return {
            "mean": None if self.mean is None else self.mean.tolist(),
            "std": None if self.std is None else self.std.tolist(),
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "FeatureScaler":
        mean = None if payload.get("mean") is None else np.array(payload["mean"])
        std = None if payload.get("std") is None else np.array(payload["std"])
        return cls(mean, std)


def encode_angle(degrees: float) -> tuple[float, float]:
    """Angle to (sin, cos) so 359 deg and 1 deg sit next to each other."""
    radians = math.radians(degrees)
    return math.sin(radians), math.cos(radians)


def build_feature_vector(vessel: dict, speed_kn: float, weather: dict,
                         draft_fore: float | None = None,
                         draft_aft: float | None = None,
                         rpm: float | None = None,
                         shaft_power_kw: float | None = None) -> np.ndarray:
    """One timestep of features, in the canonical FEATURE_NAMES order."""
    draft = float(vessel.get("draft_design_m", 10.0))
    draft_fore = draft if draft_fore is None else draft_fore
    draft_aft = draft * 1.02 if draft_aft is None else draft_aft

    # RPM from speed via the propeller law, when not measured directly.
    if rpm is None:
        rpm = 62.0 * (speed_kn / max(float(vessel.get("speed_service_kn", 13.0)), 1e-6))
    if shaft_power_kw is None:
        mcr = float(vessel.get("main_engine_kw", 10000.0))
        ratio = speed_kn / max(float(vessel.get("speed_service_kn", 13.0)), 1e-6)
        shaft_power_kw = mcr * 0.7 * ratio ** 3

    wind_sin, wind_cos = encode_angle(float(weather.get("wind_direction_deg", 0.0)))
    wave_sin, wave_cos = encode_angle(float(weather.get("wave_direction_deg", 0.0)))
    cur_sin, cur_cos = encode_angle(float(weather.get("current_direction_deg", 0.0)))

    values = {
        "speed_over_ground": speed_kn,
        "draft_fore": draft_fore,
        "draft_aft": draft_aft,
        "rpm": rpm,
        "shaft_power": shaft_power_kw,
        "wind_speed": float(weather.get("wind_speed_kn", 0.0)),
        "wind_direction_sin": wind_sin,
        "wind_direction_cos": wind_cos,
        "wave_height": float(weather.get("wave_height_m", 0.0)),
        "wave_period": float(weather.get("wave_period_s", 8.0)),
        "wave_direction_sin": wave_sin,
        "wave_direction_cos": wave_cos,
        "current_speed": float(weather.get("current_speed_kn", 0.0)),
        "current_direction_sin": cur_sin,
        "current_direction_cos": cur_cos,
        "vessel_dwt": float(vessel.get("dwt", 50000.0)),
        "vessel_length": float(vessel.get("length_m", 200.0)),
        "vessel_beam": float(vessel.get("beam_m", 32.0)),
        "block_coefficient": float(vessel.get("block_coefficient", 0.75)),
    }
    return np.array([values[name] for name in FEATURE_NAMES], dtype=np.float64)


def build_sequence(vessel: dict, speeds_kn: list[float],
                   weather_by_leg: list[dict]) -> np.ndarray:
    """A [T, F] sequence covering one voyage's legs."""
    steps = []
    for i, speed in enumerate(speeds_kn):
        weather = weather_by_leg[i] if i < len(weather_by_leg) else (weather_by_leg[-1] if weather_by_leg else {})
        steps.append(build_feature_vector(vessel, speed, weather))
    return np.stack(steps) if steps else np.zeros((0, len(FEATURE_NAMES)))


def generate_training_data(vessels: list[dict], n_voyages: int = 400,
                           seq_len: int = 12, seed: int = 7) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Synthesise a training set from the physics engine.

    Labels come from the Holtrop-Mennen chain with a small multiplicative noise
    term standing in for sensor error and unmodelled fouling. Training the
    network on physics output is a distillation step, not a circular argument:
    it produces a fast differentiable surrogate that the physics-informed loss
    keeps honest, and it is the same procedure used when real AIS-plus-noon-report
    data is unavailable.

    Returns (X, y, energy) where y is fuel rate in kg/h.
    """
    from ..physics.propulsion import compute_propulsion
    from ..physics.fuel_conversion import get_fuel

    rng = np.random.default_rng(seed)
    X_list, y_list, e_list = [], [], []

    for _ in range(n_voyages):
        vessel = vessels[rng.integers(0, len(vessels))]
        fuel = get_fuel(vessel.get("current_fuel", "VLSFO"))

        v_min = float(vessel["speed_min_kn"])
        v_max = float(vessel["speed_max_kn"])

        # A voyage holds a base speed and drifts around it, as real ships do.
        base_speed = rng.uniform(v_min, v_max)
        base_wave = abs(rng.normal(1.8, 1.1))
        base_wind = abs(rng.normal(12.0, 6.0))

        seq_X, seq_y, seq_e = [], [], []
        for _t in range(seq_len):
            speed = float(np.clip(base_speed + rng.normal(0, 0.6), v_min, v_max))
            weather = {
                "wind_speed_kn": float(np.clip(base_wind + rng.normal(0, 3.0), 0, 50)),
                "wind_direction_deg": float(rng.uniform(0, 360)),
                "wave_height_m": float(np.clip(base_wave + rng.normal(0, 0.5), 0.2, 8.0)),
                "wave_period_s": float(np.clip(rng.normal(8.0, 1.8), 3.0, 16.0)),
                "wave_direction_deg": float(rng.uniform(0, 360)),
                "current_speed_kn": float(np.clip(abs(rng.normal(0.5, 0.4)), 0, 2.5)),
                "current_direction_deg": float(rng.uniform(0, 360)),
            }
            heading = float(rng.uniform(0, 360))
            state, _ = compute_propulsion(vessel, speed, heading, weather)

            energy_mj_per_hour = state.total_power_kw * 3.6
            fuel_kg_per_hour = energy_mj_per_hour / (
                float(fuel["lhv_mj_per_kg"]) * float(fuel["engine_efficiency"])
            )
            # Measurement noise: flow meters and noon reports are ~3% at best.
            fuel_kg_per_hour *= (1.0 + rng.normal(0, 0.03))

            seq_X.append(build_feature_vector(vessel, speed, weather,
                                              shaft_power_kw=state.shaft_power_kw))
            seq_y.append(fuel_kg_per_hour)
            seq_e.append(energy_mj_per_hour)

        X_list.append(np.stack(seq_X))
        y_list.append(np.array(seq_y))
        e_list.append(np.array(seq_e))

    return np.stack(X_list), np.stack(y_list), np.stack(e_list)
