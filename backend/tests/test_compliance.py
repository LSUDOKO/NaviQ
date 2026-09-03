"""IMO CII methodology and Well-to-Wake emissions accounting."""

import json
from pathlib import Path

import pytest

from app.core.compliance.cii_calculator import (
    attained_aer,
    calculate_cii,
    classify_rating,
    co2_from_fuel_mix,
    reference_cii,
    required_cii,
)
from app.core.compliance.imo_rules import list_ship_types, reduction_factor
from app.core.compliance.seemp import recommend_actions
from app.core.emissions.shore_power import evaluate_shore_power
from app.core.emissions.wtw_calculator import compare_fuels, compute_emissions

DATA = Path(__file__).resolve().parents[1] / "app" / "data"


@pytest.fixture(scope="module")
def fleet():
    with open(DATA / "fleet.json") as fh:
        return json.load(fh)["vessels"]


# --- CII -------------------------------------------------------------------

def test_reduction_factor_tightens_over_time():
    """Z climbs toward the 2030 target; that is the whole regulatory pressure."""
    assert reduction_factor(2019) == 0.0
    assert reduction_factor(2023) == 5.0
    assert reduction_factor(2026) == 11.0
    assert reduction_factor(2030) == 19.0
    assert reduction_factor(2032) > reduction_factor(2030)


def test_required_cii_falls_as_z_rises():
    a = required_cii("bulk_carrier", 82000, 2023)
    b = required_cii("bulk_carrier", 82000, 2030)
    assert b < a


def test_reference_line_decreases_with_capacity():
    """Larger ships are inherently more efficient per tonne-mile."""
    small = reference_cii("bulk_carrier", 20000)
    large = reference_cii("bulk_carrier", 150000)
    assert large < small


def test_every_ship_type_gives_a_sane_reference_line():
    """A coefficient error shows up as an absurd reference value, not an exception."""
    for spec in list_ship_types():
        for dwt in (30000, 80000, 150000):
            value = reference_cii(spec["id"], dwt)
            assert 0.5 < value < 500.0, f"{spec['id']} at {dwt} DWT gave {value}"


@pytest.mark.parametrize("ship_type", [s["id"] for s in list_ship_types()
                                       if "capacity_threshold" in s])
def test_piecewise_reference_lines_are_continuous(ship_type):
    """Both branches must meet at the threshold.

    A discontinuity here misrates an entire size class silently: the value still
    computes, the rating is just wrong. Two coefficients in this table were
    caught exactly this way.
    """
    spec = next(s for s in list_ship_types() if s["id"] == ship_type)
    threshold = spec["capacity_threshold"]
    below = reference_cii(ship_type, threshold - 1)
    above = reference_cii(ship_type, threshold + 1)
    assert below == pytest.approx(above, rel=0.01), (
        f"{ship_type} jumps from {below:.4f} to {above:.4f} at {threshold} DWT"
    )


def test_aer_formula():
    """AER = CO2 / (capacity x distance), in grams per tonne-mile."""
    # 1000 t CO2 over 50,000 DWT and 10,000 nm.
    aer = attained_aer(1000.0, 50_000, 10_000)
    assert aer == pytest.approx(1000.0 * 1e6 / (50_000 * 10_000))


def test_co2_uses_imo_carbon_factors():
    """HFO's carbon factor is 3.114 tCO2 per tonne of fuel."""
    assert co2_from_fuel_mix({"HFO": 100.0}) == pytest.approx(311.4)
    # Ammonia contains no carbon, so it contributes nothing to the CII numerator.
    assert co2_from_fuel_mix({"NH3_GREEN": 100.0}) == pytest.approx(0.0)


def test_rating_bands_are_ordered():
    """Better intensity must never yield a worse letter."""
    required = 5.0
    ratings = [classify_rating(v, required, "bulk_carrier")[0] for v in (3.0, 4.5, 5.0, 5.5, 7.0)]
    assert ratings == sorted(ratings)
    assert ratings[0] == "A"
    assert ratings[-1] == "E"


def test_fleet_ratings_are_plausible(fleet):
    """A demo fleet that rates all-E or all-A would signal a broken reference line."""
    from app.core.physics.fuel_conversion import energy_to_fuel_mass
    from app.core.physics.propulsion import compute_propulsion

    weather = {"wind_speed_kn": 10.0, "wind_direction_deg": 60.0, "wave_height_m": 1.5,
               "wave_period_s": 8.0, "wave_direction_deg": 60.0,
               "current_speed_kn": 0.0, "current_direction_deg": 0.0}

    ratings = []
    for vessel in fleet:
        distance = vessel["annual_distance_nm"]
        hours = distance / vessel["speed_service_kn"]
        state, _ = compute_propulsion(vessel, vessel["speed_service_kn"], 90.0, weather)
        energy = state.total_power_kw * hours * 3.6
        mass = energy_to_fuel_mass(energy, vessel["current_fuel"])
        result = calculate_cii(vessel["ship_type"], vessel["dwt"], distance,
                               {vessel["current_fuel"]: mass}, 2026)
        ratings.append(result.rating)

    assert len(set(ratings)) > 1, f"no spread across the fleet: {ratings}"
    assert all(r in "ABCDE" for r in ratings)


def test_lower_fuel_burn_improves_rating():
    result_low = calculate_cii("bulk_carrier", 82000, 60000, {"HFO": 4000.0}, 2026)
    result_high = calculate_cii("bulk_carrier", 82000, 60000, {"HFO": 9000.0}, 2026)
    assert result_low.attained_cii < result_high.attained_cii
    assert "ABCDE".index(result_low.rating) <= "ABCDE".index(result_high.rating)


# --- SEEMP -----------------------------------------------------------------

def test_no_action_required_when_compliant():
    result = calculate_cii("bulk_carrier", 82000, 60000, {"HFO": 3000.0}, 2026)
    plan = recommend_actions(result)
    if result.rating in ("A", "B"):
        assert plan["action_required"] is False
        assert plan["recommended_measures"] == []


def test_corrective_plan_offered_when_failing():
    """A poor rating must produce concrete measures, not just a warning."""
    result = calculate_cii("bulk_carrier", 82000, 60000, {"HFO": 20000.0}, 2026)
    assert result.rating in ("D", "E")
    plan = recommend_actions(result)
    assert plan["action_required"] is True
    assert len(plan["recommended_measures"]) > 0
    assert plan["achieved_reduction_pct"] > 0
    assert plan["statutory_note"]


# --- Well-to-Wake emissions ------------------------------------------------

def test_wtw_is_the_sum_of_its_parts():
    result = compute_emissions(500_000.0, "HFO")
    assert result.ghg_wtw_t == pytest.approx(result.ghg_wtt_t + result.ghg_ttw_t)


def test_grey_ammonia_is_worse_than_hfo_overall():
    """The headline finding: zero at the funnel, worse across the lifecycle."""
    hfo = compute_emissions(500_000.0, "HFO")
    ammonia = compute_emissions(500_000.0, "NH3_GREY")

    assert ammonia.ghg_ttw_t < hfo.ghg_ttw_t * 0.2   # near-zero at the stack
    assert ammonia.ghg_wtw_t > hfo.ghg_wtw_t         # but worse in total


def test_greenwash_flag_fires_on_grey_ammonia():
    comparison = compare_fuels(500_000.0, baseline="HFO")
    flagged = {f["fuel_id"] for f in comparison["fuels"] if f["greenwash_risk"]}
    assert "NH3_GREY" in flagged


def test_green_fuels_genuinely_reduce_lifecycle_emissions():
    comparison = compare_fuels(500_000.0, baseline="HFO")
    by_id = {f["fuel_id"]: f for f in comparison["fuels"]}
    for fuel_id in ("H2_GREEN", "NH3_GREEN", "MEOH_GREEN"):
        assert by_id[fuel_id]["delta_vs_baseline"]["ghg_wtw_pct"] < -50.0


def test_lng_advantage_shrinks_once_methane_slip_counts():
    """CO2-only accounting flatters LNG; CO2e does not."""
    comparison = compare_fuels(500_000.0, baseline="HFO")
    lng = next(f for f in comparison["fuels"] if f["fuel_id"] == "LNG")
    # The CII (CO2-only) benefit is ~12%, but the lifecycle benefit is far smaller.
    assert -20.0 < lng["delta_vs_baseline"]["ghg_wtw_pct"] < 0.0


def test_fuels_ranked_by_lifecycle_emissions():
    comparison = compare_fuels(500_000.0)
    values = [f["ghg_wtw_t"] for f in comparison["fuels"]]
    assert values == sorted(values)


# --- Shore power -----------------------------------------------------------

def test_shore_power_blocked_where_infeasible(fleet):
    """A vessel without a connection cannot use shore power anywhere."""
    incapable = next(v for v in fleet if not v["shore_power_capable"])
    result = evaluate_shore_power(incapable, "SGSIN", 30.0)
    assert result["feasible"] is False
    assert result["recommended"] is False
    assert result["blockers"]


def test_shore_power_recommended_where_it_helps(fleet):
    capable = next(v for v in fleet if v["shore_power_capable"])
    result = evaluate_shore_power(capable, "SGSIN", 30.0)
    assert result["feasible"] is True
    assert result["ghg_saving_wtw_t"] > 0
    assert result["recommended"] is True


def test_shore_power_unavailable_at_ports_without_it(fleet):
    capable = next(v for v in fleet if v["shore_power_capable"])
    result = evaluate_shore_power(capable, "AEFJR", 30.0)  # Fujairah has no OPS
    assert result["feasible"] is False


def test_longer_berth_stay_saves_more(fleet):
    capable = next(v for v in fleet if v["shore_power_capable"])
    short = evaluate_shore_power(capable, "SGSIN", 12.0)
    long = evaluate_shore_power(capable, "SGSIN", 48.0)
    assert long["ghg_saving_wtw_t"] > short["ghg_saving_wtw_t"]
