"""BiLSTM with time-aware feature-similarity self-attention for fuel prediction.

Architecture
------------
    Input  [B, T, F]  ->  Feature embedding (Linear-ReLU-Dropout)
                      ->  BiLSTM (2 layers, hidden 128, bidirectional)
                      ->  Time-aware feature-similarity self-attention
                      ->  Heads: mu (mean fuel rate) and log_var (aleatoric noise)

Why bidirectional: a voyage segment's fuel burn depends on what the ship is
sailing *into* as much as what it has just come through. A forward-only model
cannot see the sea state building ahead of it within the window.

Why time-aware attention: standard scaled dot-product attention treats a
reading from 30 minutes ago and one from 30 hours ago identically once their
feature vectors match. Vessel dynamics have memory that decays, so the
attention logits carry an explicit temporal decay term:

    score_ij = (q_i . k_j)/sqrt(d)  -  gamma * |t_i - t_j|

Uncertainty
-----------
Two sources, reported separately because they mean different things:

    aleatoric   irreducible sensor and sea-state noise; the log_var head
    epistemic   model ignorance on unfamiliar conditions; Monte Carlo Dropout

    sigma_total^2 = sigma_aleatoric^2 + sigma_epistemic^2

Epistemic uncertainty is what tells an operator "this prediction is on a sea
state the model has barely seen" -- which is exactly when a point estimate is
most dangerous to trust.

Reference: Gal & Ghahramani (2016) "Dropout as a Bayesian Approximation",
ICML 2016; Kendall & Gal (2017) NeurIPS.
"""

from __future__ import annotations

import math

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:  # pragma: no cover - physics predictor is the fallback
    TORCH_AVAILABLE = False
    torch = None
    nn = object

# Feature order the data processor must produce.
FEATURE_NAMES = [
    "speed_over_ground", "draft_fore", "draft_aft", "rpm", "shaft_power",
    "wind_speed", "wind_direction_sin", "wind_direction_cos",
    "wave_height", "wave_period", "wave_direction_sin", "wave_direction_cos",
    "current_speed", "current_direction_sin", "current_direction_cos",
    "vessel_dwt", "vessel_length", "vessel_beam", "block_coefficient",
]
N_FEATURES = len(FEATURE_NAMES)


if TORCH_AVAILABLE:

    class TimeAwareSelfAttention(nn.Module):
        """Self-attention whose logits decay with temporal separation."""

        def __init__(self, dim: int, n_heads: int = 4, dropout: float = 0.1,
                     gamma_init: float = 0.1):
            super().__init__()
            assert dim % n_heads == 0, "dim must divide evenly into n_heads"
            self.dim = dim
            self.n_heads = n_heads
            self.head_dim = dim // n_heads

            self.q_proj = nn.Linear(dim, dim)
            self.k_proj = nn.Linear(dim, dim)
            self.v_proj = nn.Linear(dim, dim)
            self.out_proj = nn.Linear(dim, dim)
            self.dropout = nn.Dropout(dropout)
            # Learned per-head decay rate: some heads attend locally, others globally.
            self.gamma = nn.Parameter(torch.full((n_heads,), gamma_init))

        def forward(self, x: "torch.Tensor", timestamps: "torch.Tensor | None" = None):
            B, T, D = x.shape
            H, Hd = self.n_heads, self.head_dim

            q = self.q_proj(x).view(B, T, H, Hd).transpose(1, 2)
            k = self.k_proj(x).view(B, T, H, Hd).transpose(1, 2)
            v = self.v_proj(x).view(B, T, H, Hd).transpose(1, 2)

            scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(Hd)

            if timestamps is None:
                timestamps = torch.arange(T, device=x.device, dtype=x.dtype).expand(B, T)
            # |t_i - t_j| for every pair in the window.
            dt = (timestamps.unsqueeze(2) - timestamps.unsqueeze(1)).abs()
            decay = self.gamma.abs().view(1, H, 1, 1) * dt.unsqueeze(1)
            scores = scores - decay

            weights = self.dropout(torch.softmax(scores, dim=-1))
            out = torch.matmul(weights, v)
            out = out.transpose(1, 2).contiguous().view(B, T, D)
            return self.out_proj(out), weights

    class FuelPredictionNet(nn.Module):
        """The full prediction network: embedding, BiLSTM, attention, dual heads."""

        def __init__(self, n_features: int = N_FEATURES, hidden: int = 128,
                     n_layers: int = 2, n_heads: int = 4, dropout: float = 0.15):
            super().__init__()
            self.dropout_p = dropout

            self.embedding = nn.Sequential(
                nn.Linear(n_features, hidden),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.LayerNorm(hidden),
            )
            self.lstm = nn.LSTM(
                hidden, hidden, num_layers=n_layers, batch_first=True,
                bidirectional=True, dropout=dropout if n_layers > 1 else 0.0,
            )
            self.attention = TimeAwareSelfAttention(hidden * 2, n_heads, dropout)
            self.norm = nn.LayerNorm(hidden * 2)

            # Linear head, no Softplus. The target is standardised log fuel rate,
            # which is signed; positivity is guaranteed by exponentiating at
            # inference, not by clamping the head. A Softplus here would floor
            # the output at zero and the network could only emit a constant.
            self.mean_head = nn.Sequential(
                nn.Linear(hidden * 2, hidden), nn.ReLU(),
                nn.Dropout(dropout), nn.Linear(hidden, 1),
            )
            # log_var rather than var keeps the output unconstrained and the
            # exponential in the NLL numerically stable.
            self.logvar_head = nn.Sequential(
                nn.Linear(hidden * 2, hidden), nn.ReLU(),
                nn.Dropout(dropout), nn.Linear(hidden, 1),
            )

        def forward(self, x: "torch.Tensor", timestamps: "torch.Tensor | None" = None):
            h = self.embedding(x)
            h, _ = self.lstm(h)
            attended, attn_weights = self.attention(h, timestamps)
            h = self.norm(h + attended)  # residual around attention

            mean = self.mean_head(h).squeeze(-1)
            log_var = self.logvar_head(h).squeeze(-1).clamp(-8.0, 6.0)
            return mean, log_var, attn_weights

        def enable_mc_dropout(self) -> None:
            """Put dropout layers in train mode while the rest stays in eval.

            This is what makes Monte Carlo Dropout work at inference: each
            forward pass samples a different sub-network, and the spread across
            passes approximates the posterior predictive variance.
            """
            self.eval()
            for module in self.modules():
                if isinstance(module, nn.Dropout):
                    module.train()

        @torch.no_grad()
        def predict_with_uncertainty(self, x: "torch.Tensor", n_samples: int = 40,
                                     timestamps: "torch.Tensor | None" = None) -> dict:
            """MC-Dropout inference returning decomposed uncertainty."""
            self.enable_mc_dropout()
            means, variances = [], []
            for _ in range(n_samples):
                mu, log_var, _ = self.forward(x, timestamps)
                means.append(mu)
                variances.append(torch.exp(log_var))

            stacked_mean = torch.stack(means)          # [S, B, T]
            stacked_var = torch.stack(variances)

            predictive_mean = stacked_mean.mean(dim=0)
            epistemic_var = stacked_mean.var(dim=0, unbiased=False)
            aleatoric_var = stacked_var.mean(dim=0)
            total_var = epistemic_var + aleatoric_var

            return {
                "mean": predictive_mean,
                "epistemic_std": epistemic_var.sqrt(),
                "aleatoric_std": aleatoric_var.sqrt(),
                "total_std": total_var.sqrt(),
                "samples": stacked_mean,
            }

else:  # pragma: no cover

    class TimeAwareSelfAttention:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            raise ImportError("PyTorch is required for the neural predictor.")

    class FuelPredictionNet:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            raise ImportError("PyTorch is required for the neural predictor.")


def build_model(**kwargs):
    """Factory that fails loudly when torch is absent, rather than silently."""
    if not TORCH_AVAILABLE:
        raise ImportError(
            "PyTorch is not installed. The physics predictor "
            "(app.core.prediction.predictor) runs without it."
        )
    return FuelPredictionNet(**kwargs)
