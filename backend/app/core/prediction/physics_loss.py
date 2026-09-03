"""Physics-informed loss: data fit plus penalties for violating conservation.

    L = L_data + lambda_phys * L_phys + lambda_reg * L_reg

L_data is the heteroscedastic Gaussian negative log-likelihood, so the network
learns its own noise level rather than assuming a constant one:

    L_nll = 0.5 * [ exp(-log_var) * (y - mu)^2 + log_var ]

L_phys penalises three things a purely data-driven model will happily predict:

  1. Energy conservation. Chemical energy in the fuel must at least cover the
     propulsive energy delivered. A model that predicts less is claiming a
     free lunch.
  2. Monotonicity in speed. At fixed weather, more speed cannot burn less fuel.
  3. Cubic scaling. Power tracks roughly v^3, so log(fuel) against log(speed)
     should have a slope near 3.

The payoff is extrapolation: a model trained only on 1-2 m seas will still
respect energy balance when shown a 5 m sea, because the physics term
constrains the whole input space rather than just the sampled region.

Reference: Raissi, Perdikaris & Karniadakis (2019) "Physics-informed neural
networks", Journal of Computational Physics 378.
"""

from __future__ import annotations

try:
    import torch
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:  # pragma: no cover
    TORCH_AVAILABLE = False
    torch = None


def gaussian_nll(y_true, y_pred_mean, log_var):
    """Heteroscedastic negative log-likelihood (up to an additive constant)."""
    precision = torch.exp(-log_var)
    return (0.5 * (precision * (y_true - y_pred_mean) ** 2 + log_var)).mean()


def energy_conservation_loss(fuel_pred_kg, propulsive_energy_mj, lhv_mj_per_kg,
                             engine_efficiency):
    """Penalise predictions that cannot supply the propulsive energy demanded.

    Hinge on the deficit only: over-prediction is a data-fit problem, but
    under-prediction below the energy floor is physically impossible.
    """
    available_mj = fuel_pred_kg * lhv_mj_per_kg * engine_efficiency
    deficit = torch.relu(propulsive_energy_mj - available_mj)
    return (deficit / (propulsive_energy_mj.abs() + 1e-6)).pow(2).mean()


def monotonicity_loss(fuel_pred, speed):
    """Penalise fuel decreasing as speed rises, within a sequence.

    Both differences are normalised before multiplying. Working on raw kg/h
    makes the penalty scale with the square of the fuel rate, so a 6000 kg/h
    vessel would contribute hundreds of times the penalty of a 250 kg/h one and
    the term would dominate the data loss outright -- driving the network to a
    flat output, which trivially satisfies monotonicity.
    """
    scale = fuel_pred.abs().mean().clamp_min(1e-6)
    d_speed = (speed[:, 1:] - speed[:, :-1]) / speed.abs().mean().clamp_min(1e-6)
    d_fuel = (fuel_pred[:, 1:] - fuel_pred[:, :-1]) / scale
    # Violation where speed goes up but predicted fuel goes down.
    violation = torch.relu(-d_fuel) * torch.relu(d_speed)
    return violation.pow(2).mean()


def cubic_scaling_loss(fuel_pred, speed, target_exponent: float = 3.0,
                       tolerance: float = 0.6):
    """Keep d log(fuel) / d log(speed) near the theoretical cubic exponent."""
    eps = 1e-6
    log_speed = torch.log(speed.clamp_min(eps))
    log_fuel = torch.log(fuel_pred.clamp_min(eps))

    d_log_speed = log_speed[:, 1:] - log_speed[:, :-1]
    d_log_fuel = log_fuel[:, 1:] - log_fuel[:, :-1]

    # The finite-difference exponent d(log f)/d(log v) is only meaningful when
    # the speed actually moves. Between adjacent legs the change is often well
    # under 1%, and dividing by that near-zero denominator produces exponents in
    # the hundreds -- noise, not physics. Require a substantive speed change
    # (>5% in log terms) before the ratio is trusted at all.
    mask = d_log_speed.abs() > 0.05
    if mask.sum() == 0:
        return torch.zeros((), device=fuel_pred.device, dtype=fuel_pred.dtype)

    exponent = d_log_fuel[mask] / d_log_speed[mask]
    # Clamp before the hinge so a single pathological pair cannot dominate.
    exponent = exponent.clamp(-10.0, 10.0)
    deviation = torch.relu((exponent - target_exponent).abs() - tolerance)
    return deviation.pow(2).mean()


def physics_informed_loss(y_true, y_pred_mean, log_var, speed,
                          propulsive_energy_mj=None, lhv_mj_per_kg: float = 40.2,
                          engine_efficiency: float = 0.49,
                          lambda_phys: float = 0.1, lambda_reg: float = 1e-4,
                          model=None) -> dict:
    """Assemble the full objective and return every component for logging."""
    if not TORCH_AVAILABLE:
        raise ImportError("PyTorch is required for the physics-informed loss.")

    l_data = gaussian_nll(y_true, y_pred_mean, log_var)

    l_energy = torch.zeros((), device=y_pred_mean.device, dtype=y_pred_mean.dtype)
    if propulsive_energy_mj is not None:
        l_energy = energy_conservation_loss(
            y_pred_mean, propulsive_energy_mj, lhv_mj_per_kg, engine_efficiency
        )

    l_mono = monotonicity_loss(y_pred_mean, speed)
    l_cubic = cubic_scaling_loss(y_pred_mean, speed)
    l_phys = l_energy + l_mono + 0.5 * l_cubic

    l_reg = torch.zeros((), device=y_pred_mean.device, dtype=y_pred_mean.dtype)
    if model is not None:
        l_reg = sum((p ** 2).sum() for p in model.parameters() if p.requires_grad)

    total = l_data + lambda_phys * l_phys + lambda_reg * l_reg

    return {
        "total": total,
        "data": l_data,
        "physics": l_phys,
        "energy": l_energy,
        "monotonicity": l_mono,
        "cubic": l_cubic,
        "regularization": l_reg,
    }
