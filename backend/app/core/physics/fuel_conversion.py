"""Energy-to-fuel-mass conversion across the multi-fuel matrix.

    m_f = E_prop / (LHV_f * eta_f)

Energy is fuel-neutral; mass is not. Ammonia carries 18.6 MJ/kg against HFO's
40.2, so the same voyage burns roughly 2.3x the tonnage -- which is why bunker
volume, not just price, decides whether an alternative fuel is viable on a
given route.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@lru_cache(maxsize=1)
def load_fuel_database() -> dict[str, dict]:
    """Fuel properties keyed by fuel id."""
    with open(DATA_DIR / "fuel_database.json") as fh:
        payload = json.load(fh)
    return {fuel["id"]: fuel for fuel in payload["fuels"]}


def get_fuel(fuel_id: str) -> dict:
    fuels = load_fuel_database()
    if fuel_id not in fuels:
        raise KeyError(f"Unknown fuel '{fuel_id}'. Known: {sorted(fuels)}")
    return fuels[fuel_id]


def list_fuels() -> list[dict]:
    return list(load_fuel_database().values())


def energy_to_fuel_mass(energy_mj: float, fuel_id: str) -> float:
    """Fuel mass in tonnes required to deliver `energy_mj` of propulsive energy."""
    fuel = get_fuel(fuel_id)
    lhv = float(fuel["lhv_mj_per_kg"])
    eta = float(fuel["engine_efficiency"])
    mass_kg = energy_mj / max(lhv * eta, 1e-9)
    return mass_kg / 1000.0


def fuel_mass_to_energy(mass_t: float, fuel_id: str) -> float:
    """Propulsive energy in MJ obtainable from `mass_t` tonnes of fuel."""
    fuel = get_fuel(fuel_id)
    return mass_t * 1000.0 * float(fuel["lhv_mj_per_kg"]) * float(fuel["engine_efficiency"])


def fuel_volume_m3(mass_t: float, fuel_id: str) -> float:
    """Bunker volume in cubic metres -- the binding constraint for H2 and NH3."""
    fuel = get_fuel(fuel_id)
    return mass_t * 1000.0 / max(float(fuel["density_kg_per_m3"]), 1e-6)


def fuel_cost_usd(mass_t: float, fuel_id: str) -> float:
    return mass_t * float(get_fuel(fuel_id)["price_usd_per_tonne"])


def convert_energy(energy_mj: float, fuel_id: str) -> dict:
    """Full conversion record for one fuel: mass, volume, cost and energy check."""
    fuel = get_fuel(fuel_id)
    mass_t = energy_to_fuel_mass(energy_mj, fuel_id)
    return {
        "fuel_id": fuel_id,
        "fuel_name": fuel["name"],
        "mass_tonnes": mass_t,
        "volume_m3": fuel_volume_m3(mass_t, fuel_id),
        "cost_usd": fuel_cost_usd(mass_t, fuel_id),
        "lhv_mj_per_kg": fuel["lhv_mj_per_kg"],
        "engine_efficiency": fuel["engine_efficiency"],
        "propulsive_energy_mj": energy_mj,
        "fuel_energy_mj": mass_t * 1000.0 * float(fuel["lhv_mj_per_kg"]),
    }


def verify_energy_balance(energy_mj: float, mass_t: float, fuel_id: str,
                          tolerance: float = 1e-6) -> bool:
    """First-law check: chemical energy in must cover propulsive energy out.

    Used by the physics-informed loss to reject predictions that would violate
    energy conservation.
    """
    fuel = get_fuel(fuel_id)
    chemical_energy_mj = mass_t * 1000.0 * float(fuel["lhv_mj_per_kg"])
    return chemical_energy_mj >= energy_mj * (1.0 - tolerance)
