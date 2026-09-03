"""Well-to-Wake lifecycle greenhouse gas accounting.

    GHG_TtW = m_f * EF_TtW          (combustion, incl. CH4 slip and N2O)
    GHG_WtT = m_f * LHV_f * EF_WtT  (extraction, conversion, transport, bunkering)
    GHG_WtW = GHG_WtT + GHG_TtW
    CI_WtW  = GHG_WtW / (m_f * LHV_f)   [gCO2e/MJ]

Tank-to-Wake alone is the number regulations have historically counted, and it
is misleading: ammonia made by steam-reforming natural gas emits nothing at the
funnel while emitting more than heavy fuel oil across its life. Reporting WtT
and TtW separately is what makes a fuel choice honest.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

from ..physics.fuel_conversion import (
    energy_to_fuel_mass,
    fuel_cost_usd,
    fuel_volume_m3,
    get_fuel,
    list_fuels,
)


@dataclass
class EmissionsResult:
    fuel_id: str
    fuel_name: str
    fuel_family: str
    fuel_mass_t: float
    fuel_volume_m3: float
    fuel_cost_usd: float
    fuel_energy_mj: float
    co2_ttw_t: float          # IMO carbon factor CO2 only (used for CII)
    ghg_ttw_t: float          # CO2e incl. CH4 + N2O
    ghg_wtt_t: float
    ghg_wtw_t: float
    ci_ttw_gco2e_per_mj: float
    ci_wtw_gco2e_per_mj: float
    sox_t: float
    nox_t: float

    def to_dict(self) -> dict:
        out = asdict(self)
        for key, value in out.items():
            if isinstance(value, float):
                out[key] = round(value, 6)
        return out


# NOx emission factors by fuel family, gNOx per kWh at IMO Tier III.
NOX_G_PER_KWH = {
    "HFO": 14.4, "VLSFO": 13.8, "MGO": 12.5, "LNG": 2.6,
    "MEOH_GREY": 8.2, "MEOH_GREEN": 8.2,
    "NH3_GREY": 9.8, "NH3_GREEN": 9.8, "H2_GREEN": 3.1,
}


def compute_emissions(energy_mj: float, fuel_id: str) -> EmissionsResult:
    """Full lifecycle emissions for delivering `energy_mj` of propulsive energy."""
    fuel = get_fuel(fuel_id)
    mass_t = energy_to_fuel_mass(energy_mj, fuel_id)
    mass_g = mass_t * 1e6

    lhv = float(fuel["lhv_mj_per_kg"])
    fuel_energy_mj = mass_t * 1000.0 * lhv

    # Tank-to-Wake: CO2 only (regulatory CII basis) and full CO2e.
    co2_ttw_t = mass_t * float(fuel["cf_tco2_per_tfuel"])
    ghg_ttw_g = mass_g * float(fuel["ef_ttw_gco2e_per_gfuel"])
    ghg_ttw_t = ghg_ttw_g / 1e6

    # Well-to-Tank is defined per MJ of fuel energy, not per gram of fuel.
    ghg_wtt_g = fuel_energy_mj * float(fuel["ef_wtt_gco2e_per_mj"])
    ghg_wtt_t = ghg_wtt_g / 1e6

    ghg_wtw_t = ghg_wtt_t + ghg_ttw_t

    ci_ttw = ghg_ttw_g / max(fuel_energy_mj, 1e-9)
    ci_wtw = (ghg_ttw_g + ghg_wtt_g) / max(fuel_energy_mj, 1e-9)

    sox_t = mass_t * float(fuel.get("sox_content_pct", 0.0)) / 100.0 * 2.0  # S -> SO2
    nox_t = (energy_mj / 3.6) * NOX_G_PER_KWH.get(fuel_id, 10.0) / 1e6

    return EmissionsResult(
        fuel_id=fuel_id,
        fuel_name=fuel["name"],
        fuel_family=fuel["family"],
        fuel_mass_t=mass_t,
        fuel_volume_m3=fuel_volume_m3(mass_t, fuel_id),
        fuel_cost_usd=fuel_cost_usd(mass_t, fuel_id),
        fuel_energy_mj=fuel_energy_mj,
        co2_ttw_t=co2_ttw_t,
        ghg_ttw_t=ghg_ttw_t,
        ghg_wtt_t=ghg_wtt_t,
        ghg_wtw_t=ghg_wtw_t,
        ci_ttw_gco2e_per_mj=ci_ttw,
        ci_wtw_gco2e_per_mj=ci_wtw,
        sox_t=sox_t,
        nox_t=nox_t,
    )


def compare_fuels(energy_mj: float, fuel_ids: list[str] | None = None,
                  baseline: str = "HFO") -> dict:
    """Rank every candidate fuel for the same propulsive energy demand.

    Returns per-fuel results plus deltas against a baseline, so the UI can say
    "-38% WtW vs HFO, +122% cost" rather than making the user divide numbers.
    """
    if fuel_ids is None:
        fuel_ids = [f["id"] for f in list_fuels()]

    results = [compute_emissions(energy_mj, fid) for fid in fuel_ids]
    base = compute_emissions(energy_mj, baseline)

    comparison = []
    for res in results:
        record = res.to_dict()
        record["delta_vs_baseline"] = {
            "baseline_fuel": baseline,
            "ghg_wtw_pct": _pct_delta(res.ghg_wtw_t, base.ghg_wtw_t),
            "ghg_ttw_pct": _pct_delta(res.ghg_ttw_t, base.ghg_ttw_t),
            "cost_pct": _pct_delta(res.fuel_cost_usd, base.fuel_cost_usd),
            "mass_pct": _pct_delta(res.fuel_mass_t, base.fuel_mass_t),
            "volume_pct": _pct_delta(res.fuel_volume_m3, base.fuel_volume_m3),
        }
        # The honesty flag: does this fuel look clean at the funnel but dirty overall?
        record["greenwash_risk"] = bool(
            res.ghg_ttw_t < base.ghg_ttw_t * 0.5 and res.ghg_wtw_t > base.ghg_wtw_t * 0.9
        )
        comparison.append(record)

    comparison.sort(key=lambda r: r["ghg_wtw_t"])

    return {
        "propulsive_energy_mj": energy_mj,
        "baseline_fuel": baseline,
        "fuels": comparison,
        "best_wtw": comparison[0]["fuel_id"] if comparison else None,
        "best_cost": min(comparison, key=lambda r: r["fuel_cost_usd"])["fuel_id"] if comparison else None,
    }


def _pct_delta(value: float, base: float) -> float:
    if abs(base) < 1e-12:
        return 0.0
    return round((value - base) / base * 100.0, 2)
