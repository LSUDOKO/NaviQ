"""Physics engine: resistance, propulsion and fuel conversion."""

import json
from pathlib import Path

import pytest

from app.core.physics.fuel_conversion import (
    convert_energy,
    energy_to_fuel_mass,
    fuel_mass_to_energy,
    verify_energy_balance,
)
from app.core.physics.propulsion import compute_propulsion, integrate_voyage_energy
from app.core.physics.resistance import compute_resistance, froude_number

DATA = Path(__file__).resolve().parents[1] / "app" / "data"

CALM = {
    "wind_speed_kn": 0.0, "wind_direction_deg": 0.0,
    "wave_height_m": 0.0, "wave_period_s": 8.0, "wave_direction_deg": 0.0,
    "current_speed_kn": 0.0, "current_direction_deg": 0.0,
}


@pytest.fixture(scope="module")
def fleet():
    with open(DATA / "fleet.json") as fh:
        return json.load(fh)["vessels"]


@pytest.fixture(scope="module")
def vessel(fleet):
    return fleet[0]


def test_resistance_rises_with_speed(vessel):
    """Resistance must increase monotonically with speed."""
    values = [compute_resistance(vessel, s, 90.0, CALM).r_total_kn for s in (8, 10, 12, 14)]
    assert values == sorted(values)
    assert all(v > 0 for v in values)


def test_resistance_superlinear_in_speed(vessel):
    """Doubling speed must more than double resistance -- it is not linear drag."""
    low = compute_resistance(vessel, 7.0, 90.0, CALM).r_total_kn
    high = compute_resistance(vessel, 14.0, 90.0, CALM).r_total_kn
    assert high > 2.5 * low


def test_waves_add_resistance(vessel):
    """A rough sea must cost more than a calm one at the same speed."""
    rough = dict(CALM, wave_height_m=4.0, wave_period_s=9.0, wave_direction_deg=90.0)
    calm = compute_resistance(vessel, 13.0, 90.0, CALM).r_total_kn
    heavy = compute_resistance(vessel, 13.0, 90.0, rough).r_total_kn
    assert heavy > calm


def test_wave_resistance_scales_quadratically(vessel):
    """Added resistance in waves goes with the square of wave height."""
    def wave_component(height):
        weather = dict(CALM, wave_height_m=height, wave_period_s=9.0, wave_direction_deg=90.0)
        return compute_resistance(vessel, 13.0, 90.0, weather).r_wave_kn

    one, three = wave_component(1.0), wave_component(3.0)
    # 3x the height should be roughly 9x the penalty.
    assert 6.0 < three / max(one, 1e-9) < 12.0


def test_head_wind_costs_more_than_following(vessel):
    """Wind direction must matter, and a head wind must be the expensive one."""
    head = dict(CALM, wind_speed_kn=30.0, wind_direction_deg=90.0)
    following = dict(CALM, wind_speed_kn=30.0, wind_direction_deg=270.0)
    on_the_nose = compute_resistance(vessel, 13.0, 90.0, head).r_wind_kn
    astern = compute_resistance(vessel, 13.0, 90.0, following).r_wind_kn
    assert on_the_nose > astern


def test_following_current_reduces_speed_through_water(vessel):
    """A following current means the hull pushes less water."""
    with_current = dict(CALM, current_speed_kn=2.0, current_direction_deg=270.0)
    result = compute_resistance(vessel, 13.0, 90.0, with_current)
    assert result.speed_through_water_kn < 13.0


def test_froude_number_dimensionless(vessel):
    fn = froude_number(13.0 * 0.514444, vessel["length_m"])
    # Merchant hulls operate in the 0.1-0.3 band.
    assert 0.05 < fn < 0.35


def test_shaft_power_within_installed_capacity(fleet):
    """Every vessel at service speed must sit inside its own engine rating."""
    for v in fleet:
        state, _ = compute_propulsion(v, v["speed_service_kn"], 90.0, CALM)
        assert 0 < state.shaft_power_kw < v["main_engine_kw"], v["name"]
        assert 20.0 < state.engine_load_pct < 95.0, v["name"]


def test_power_follows_cube_law_approximately(vessel):
    """P ~ v^3 is the governing relationship for speed decisions."""
    low, _ = compute_propulsion(vessel, 10.0, 90.0, CALM)
    high, _ = compute_propulsion(vessel, 14.0, 90.0, CALM)
    ratio = high.shaft_power_kw / low.shaft_power_kw
    cube = (14.0 / 10.0) ** 3
    assert 0.55 * cube < ratio < 1.6 * cube


def test_energy_conversion_round_trips():
    mass = energy_to_fuel_mass(500_000.0, "HFO")
    energy = fuel_mass_to_energy(mass, "HFO")
    assert energy == pytest.approx(500_000.0, rel=1e-9)


def test_energy_balance_holds():
    """Chemical energy in the fuel must cover the propulsive energy demanded."""
    energy_mj = 500_000.0
    mass = energy_to_fuel_mass(energy_mj, "HFO")
    assert verify_energy_balance(energy_mj, mass, "HFO")


def test_low_energy_density_fuels_need_more_mass():
    """Ammonia carries less than half HFO's energy per tonne."""
    hfo = convert_energy(500_000.0, "HFO")["mass_tonnes"]
    ammonia = convert_energy(500_000.0, "NH3_GREEN")["mass_tonnes"]
    assert ammonia > 2.0 * hfo


def test_hydrogen_lightest_by_mass_worst_by_volume():
    """The defining trade-off for hydrogen bunkering."""
    hfo = convert_energy(500_000.0, "HFO")
    hydrogen = convert_energy(500_000.0, "H2_GREEN")
    assert hydrogen["mass_tonnes"] < hfo["mass_tonnes"]
    assert hydrogen["volume_m3"] > 3.0 * hfo["volume_m3"]


def test_voyage_energy_sums_over_legs(vessel):
    legs = [
        {"distance_nm": 100.0, "speed_kn": 12.0, "heading_deg": 90.0, "weather": CALM},
        {"distance_nm": 150.0, "speed_kn": 13.0, "heading_deg": 45.0, "weather": CALM},
    ]
    voyage = integrate_voyage_energy(vessel, legs)
    assert voyage["total_distance_nm"] == pytest.approx(250.0)
    assert voyage["total_energy_mj"] == pytest.approx(
        sum(leg["energy_mj"] for leg in voyage["legs"])
    )
    assert voyage["total_duration_hours"] == pytest.approx(100 / 12 + 150 / 13)


def test_slow_steaming_saves_fuel(vessel):
    """The central operational claim: the same distance, slower, burns less."""
    def voyage_fuel(speed):
        legs = [{"distance_nm": 1000.0, "speed_kn": speed, "heading_deg": 90.0, "weather": CALM}]
        energy = integrate_voyage_energy(vessel, legs)["total_energy_mj"]
        return energy_to_fuel_mass(energy, "HFO")

    assert voyage_fuel(11.0) < voyage_fuel(14.0)
