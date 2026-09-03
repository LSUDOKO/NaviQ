"""Training loop for the physics-informed fuel prediction network.

Run directly to produce `app/data/model_weights.pt`:

    python -m app.core.prediction.train --epochs 60

The API loads those weights at startup when present and falls back to the
physics predictor when they are not, so the service runs either way.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
WEIGHTS_PATH = DATA_DIR / "model_weights.pt"
SCALER_PATH = DATA_DIR / "model_scaler.json"


def train(epochs: int = 60, n_voyages: int = 600, seq_len: int = 12,
          batch_size: int = 32, lr: float = 1.5e-3, lambda_phys: float = 0.08,
          seed: int = 7, verbose: bool = True, warmup_epochs: int | None = None) -> dict:
    import torch
    from torch.utils.data import DataLoader, TensorDataset

    from .data_processor import FeatureScaler, generate_training_data
    from .model import FuelPredictionNet
    from .physics_loss import gaussian_nll

    torch.manual_seed(seed)
    np.random.seed(seed)

    with open(DATA_DIR / "fleet.json") as fh:
        vessels = json.load(fh)["vessels"]

    X, y, energy = generate_training_data(vessels, n_voyages=n_voyages,
                                          seq_len=seq_len, seed=seed)

    # Chronological-style split: hold out the last 20% of voyages entirely.
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    e_train, e_val = energy[:split], energy[split:]

    scaler = FeatureScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_val_s = scaler.transform(X_val)

    # Targets are learned in log space. Fuel rate spans 234-6400 kg/h across the
    # fleet; on a linear scale the standardised loss is dominated by the large
    # vessels and the small ones contribute almost no gradient. Log space makes
    # the objective relative, which is also the error measure that matters
    # operationally -- a 5% error is 5% whether the ship burns 200 or 6000 kg/h.
    log_y_train = np.log(np.maximum(y_train, 1e-6))
    y_mean = float(log_y_train.mean())
    y_std = float(log_y_train.std())
    y_train_s = (log_y_train - y_mean) / y_std
    y_val_s = (np.log(np.maximum(y_val, 1e-6)) - y_mean) / y_std

    # Speed column, needed by the monotonicity and cubic-scaling terms.
    speed_idx = 0
    speed_train = torch.tensor(X_train[:, :, speed_idx], dtype=torch.float32)
    speed_val = torch.tensor(X_val[:, :, speed_idx], dtype=torch.float32)

    ds = TensorDataset(
        torch.tensor(X_train_s, dtype=torch.float32),
        torch.tensor(y_train_s, dtype=torch.float32),
        speed_train,
        torch.tensor(e_train, dtype=torch.float32),
    )
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True)

    # Roughly the first third of training fits the mean under MSE.
    if warmup_epochs is None:
        warmup_epochs = max(5, epochs // 3)

    model = FuelPredictionNet()
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    Xv = torch.tensor(X_val_s, dtype=torch.float32)
    yv = torch.tensor(y_val_s, dtype=torch.float32)

    history = []
    best_val = float("inf")
    best_state = None
    started = time.time()

    for epoch in range(epochs):
        model.train()
        epoch_losses = []
        for xb, yb, sb, eb in loader:
            optimizer.zero_grad()
            mu, log_var, _ = model(xb)
            # Physics terms operate in physical units, so undo the log-space scaling.
            mu_physical = torch.exp((mu * y_std + y_mean).clamp(max=20.0))

            # Warm up on plain MSE before handing control to the heteroscedastic
            # NLL. Optimised jointly from scratch, the NLL has a degenerate
            # shortcut: inflating log_var shrinks the precision term and lowers
            # the loss without the mean head ever fitting anything, and the
            # network converges to a constant with a large claimed variance.
            # Fitting the mean first removes that basin.
            if epoch < warmup_epochs:
                l_data = ((mu - yb) ** 2).mean()
            else:
                l_data = gaussian_nll(yb, mu, log_var)

            from .physics_loss import cubic_scaling_loss, monotonicity_loss
            phys = monotonicity_loss(mu_physical, sb) + 0.5 * cubic_scaling_loss(mu_physical, sb)
            total = l_data + lambda_phys * phys
            total.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_losses.append(float(total.detach()))
        scheduler.step()

        model.eval()
        with torch.no_grad():
            mu_v, log_var_v, _ = model(Xv)
            val_nll = float(((torch.exp(-log_var_v) * (yv - mu_v) ** 2 + log_var_v) * 0.5).mean())
            pred = np.exp(mu_v.numpy() * y_std + y_mean)
            mae = float(np.mean(np.abs(pred - y_val)))
            mape = float(np.mean(np.abs((pred - y_val) / np.maximum(y_val, 1e-6))) * 100)
            rmse = float(np.sqrt(np.mean((pred - y_val) ** 2)))

        history.append({"epoch": epoch, "train_loss": float(np.mean(epoch_losses)),
                        "val_nll": val_nll, "val_mae": mae, "val_mape": mape,
                        "val_rmse": rmse})

        if val_nll < best_val:
            best_val = val_nll
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

        if verbose and (epoch % 5 == 0 or epoch == epochs - 1):
            print(f"epoch {epoch:3d}  train={np.mean(epoch_losses):8.4f}  "
                  f"val_nll={val_nll:8.4f}  MAE={mae:8.2f} kg/h  MAPE={mape:6.2f}%")

    if best_state is not None:
        model.load_state_dict(best_state)

    torch.save({
        "state_dict": model.state_dict(),
        "y_mean": y_mean, "y_std": y_std,
        "feature_scaler": scaler.to_dict(),
        "seq_len": seq_len,
        "target_transform": "log",
    }, WEIGHTS_PATH)
    with open(SCALER_PATH, "w") as fh:
        json.dump({"feature_scaler": scaler.to_dict(), "y_mean": y_mean,
                   "y_std": y_std, "target_transform": "log"}, fh, indent=2)

    final = history[-1]
    metrics = {
        "epochs": epochs,
        "warmup_epochs": warmup_epochs,
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "parameters": sum(p.numel() for p in model.parameters()),
        "final_val_mae_kg_per_h": round(final["val_mae"], 3),
        "final_val_mape_pct": round(final["val_mape"], 3),
        "final_val_rmse_kg_per_h": round(final["val_rmse"], 3),
        "best_val_nll": round(best_val, 5),
        "training_seconds": round(time.time() - started, 2),
        "history": history,
        "weights_path": str(WEIGHTS_PATH),
    }
    with open(DATA_DIR / "model_metrics.json", "w") as fh:
        json.dump(metrics, fh, indent=2)
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the NAVIQ fuel prediction model")
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--voyages", type=int, default=600)
    parser.add_argument("--seq-len", type=int, default=12)
    parser.add_argument("--lr", type=float, default=1.5e-3)
    args = parser.parse_args()

    result = train(epochs=args.epochs, n_voyages=args.voyages,
                   seq_len=args.seq_len, lr=args.lr)
    print(f"\nSaved to {result['weights_path']}")
    print(f"Validation MAPE: {result['final_val_mape_pct']}%  "
          f"MAE: {result['final_val_mae_kg_per_h']} kg/h")
