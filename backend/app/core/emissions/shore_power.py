"""Cold ironing (onshore power supply) decision model.

At berth a vessel still burns fuel in auxiliary engines for hotel and cargo
load. Shore power replaces that with grid electricity -- but only helps the
climate if the port's grid is cleaner than the ship's own generators, which is
not automatic: a coal-heavy grid at 632 gCO2/kWh can be worse than a modern
auxiliary diesel.

This computes both the economic and the environmental delta so the optimizer
can treat z_shore as a genuine binary decision rather than a virtue signal.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from ..physics.fuel_conversion import get_fuel

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

# Auxiliary engine efficiency and the specific fuel consumption it implies.
AUX_ENGINE_EFFICIENCY = 0.42
# Transmission and conversion losses on the shore side.
SHORE_POWER_LOSS_FACTOR = 1.06


@lru_cache(maxsize=1)
def load_ports() -> dict[str, dict]:
    with open(DATA_DIR / "ports.json") as fh:
        payload = json.load(fh)
    return {p["id"]: p for p in payload["ports"]}


def get_port(port_id: str) -> dict:
    ports = load_ports()
    if port_id not in ports:
        raise KeyError(f"Unknown port '{port_id}'")
    return ports[port_id]


def list_ports() -> list[dict]:
    return list(load_ports().values())


def evaluate_shore_power(vessel: dict, port_id: str, berth_hours: float,
                         fuel_id: str | None = None) -> dict:
    """Compare running auxiliaries against drawing shore power at one berth call.

    Returns the cost and emissions of each option plus a recommendation. The
    `feasible` flag is what the QUBO uses to forbid the variable entirely where
    the port or the vessel cannot support it.
    """
    port = get_port(port_id)
    fuel_id = fuel_id or vessel.get("current_fuel", "VLSFO")
    fuel = get_fuel(fuel_id)

    # Hotel + cargo handling load at berth, typically 40-60% of installed aux.
    aux_load_kw = float(vessel.get("aux_engine_kw", 1000.0)) * 0.55
    energy_kwh = aux_load_kw * berth_hours
    energy_mj = energy_kwh * 3.6

    # --- Option A: run auxiliary engines on bunker fuel ---
    fuel_mass_t = energy_mj / (float(fuel["lhv_mj_per_kg"]) * AUX_ENGINE_EFFICIENCY) / 1000.0
    aux_cost_usd = fuel_mass_t * float(fuel["price_usd_per_tonne"])
    aux_co2_t = fuel_mass_t * float(fuel["cf_tco2_per_tfuel"])
    aux_ghg_ttw_t = fuel_mass_t * float(fuel["ef_ttw_gco2e_per_gfuel"])
    aux_ghg_wtt_t = (fuel_mass_t * 1000.0 * float(fuel["lhv_mj_per_kg"])
                     * float(fuel["ef_wtt_gco2e_per_mj"])) / 1e6
    aux_ghg_wtw_t = aux_ghg_ttw_t + aux_ghg_wtt_t

    # --- Option B: shore power ---
    available = port["shore_power"] == "available"
    vessel_capable = bool(vessel.get("shore_power_capable", False))
    within_capacity = float(port.get("shore_power_kw", 0.0)) >= aux_load_kw
    feasible = available and vessel_capable and within_capacity

    grid_energy_kwh = energy_kwh * SHORE_POWER_LOSS_FACTOR
    shore_cost_usd = grid_energy_kwh * float(port["electricity_usd_per_kwh"])
    shore_ghg_wtw_t = grid_energy_kwh * float(port["grid_ci_gco2_per_kwh"]) / 1e6
    # Grid emissions occur at the power station, so TtW at the ship is zero.
    shore_ghg_ttw_t = 0.0

    cost_saving = aux_cost_usd - shore_cost_usd
    ghg_saving_wtw = aux_ghg_wtw_t - shore_ghg_wtw_t
    co2_saving_ttw = aux_co2_t  # all of it, from the ship's regulatory perspective

    blockers = []
    if not available:
        blockers.append(f"Port OPS status is '{port['shore_power']}'")
    if not vessel_capable:
        blockers.append("Vessel has no shore power connection")
    if available and not within_capacity:
        blockers.append(f"Berth supplies {port.get('shore_power_kw')} kW, vessel needs {aux_load_kw:.0f} kW")

    return {
        "port_id": port_id,
        "port_name": port["name"],
        "berth_hours": berth_hours,
        "auxiliary_load_kw": aux_load_kw,
        "energy_kwh": energy_kwh,
        "feasible": feasible,
        "blockers": blockers,
        "auxiliary_option": {
            "fuel_id": fuel_id,
            "fuel_mass_t": fuel_mass_t,
            "cost_usd": aux_cost_usd,
            "co2_ttw_t": aux_co2_t,
            "ghg_ttw_t": aux_ghg_ttw_t,
            "ghg_wtw_t": aux_ghg_wtw_t,
        },
        "shore_power_option": {
            "grid_energy_kwh": grid_energy_kwh,
            "grid_ci_gco2_per_kwh": port["grid_ci_gco2_per_kwh"],
            "cost_usd": shore_cost_usd,
            "ghg_ttw_t": shore_ghg_ttw_t,
            "ghg_wtw_t": shore_ghg_wtw_t,
        },
        "cost_saving_usd": cost_saving,
        "ghg_saving_wtw_t": ghg_saving_wtw,
        "co2_saving_ttw_t": co2_saving_ttw,
        "environmentally_beneficial": ghg_saving_wtw > 0.0,
        "recommended": feasible and ghg_saving_wtw > 0.0,
        "rationale": _rationale(feasible, blockers, ghg_saving_wtw, cost_saving, port),
    }


def _rationale(feasible: bool, blockers: list[str], ghg_saving: float,
               cost_saving: float, port: dict) -> str:
    if not feasible:
        return "Shore power unavailable: " + "; ".join(blockers)
    if ghg_saving <= 0:
        return (f"Grid at {port['grid_ci_gco2_per_kwh']} gCO2/kWh is dirtier than the "
                f"vessel's auxiliaries on a Well-to-Wake basis; connecting would raise emissions.")
    direction = "saves" if cost_saving >= 0 else "costs an extra"
    return (f"Cuts {ghg_saving:.2f} t CO2e Well-to-Wake and {direction} "
            f"${abs(cost_saving):,.0f} versus running auxiliaries.")
