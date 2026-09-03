"""Version-controlled IMO regulatory parameters.

Reduction factors and rating boundaries are policy, not physics: they change by
MEPC resolution. Keeping them in data and selecting by year lets an operator ask
"what happens to my fleet when Z reaches 11% in 2026?" without redeploying code.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@lru_cache(maxsize=1)
def load_cii_reference() -> dict:
    with open(DATA_DIR / "imo_cii_reference.json") as fh:
        return json.load(fh)


def get_ship_type(ship_type_id: str) -> dict:
    ref = load_cii_reference()
    for entry in ref["ship_types"]:
        if entry["id"] == ship_type_id:
            return entry
    raise KeyError(f"Unknown ship type '{ship_type_id}'")


def list_ship_types() -> list[dict]:
    return load_cii_reference()["ship_types"]


def reduction_factor(year: int) -> float:
    """Annual reduction factor Z (%) applied to the 2019 reference line.

    Years beyond the published table are extrapolated on the IMO's stated
    trajectory toward the 2030 target, so scenario analysis can run past 2030.
    """
    factors = load_cii_reference()["reduction_factors_z_pct"]
    key = str(year)
    if key in factors:
        return float(factors[key])
    if year < 2019:
        return 0.0
    # Beyond the table: continue at the 2%/yr slope used from 2023-2030.
    return min(50.0, 19.0 + 2.0 * (year - 2030))


def rating_boundaries(ship_type_id: str) -> list[float]:
    """The dd1..dd4 multipliers separating ratings A/B/C/D/E."""
    return list(get_ship_type(ship_type_id)["dd"])


def rating_labels() -> dict:
    return load_cii_reference()["rating_labels"]
