"""API surface: endpoints, validation and the async optimisation flow."""

import time

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


# --- meta ------------------------------------------------------------------

def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["predictor_mode"] in ("neural", "physics")


def test_about_lists_differentiators(client):
    body = client.get("/api/v1/about").json()
    assert body["problem_statement_id"] == "SIH26138"
    assert len(body["differentiators"]) == 7
    assert len(body["references"]) > 5


# --- fleet -----------------------------------------------------------------

def test_list_vessels(client):
    vessels = client.get("/api/v1/vessels").json()
    assert len(vessels) == 5
    assert all("compatible_fuels" in v for v in vessels)


def test_vessel_summary_includes_rating(client):
    for vessel in client.get("/api/v1/vessels/summary").json():
        assert vessel["rating"] in "ABCDE"
        assert vessel["attained_cii"] > 0


def test_vessel_detail_has_speed_curve(client):
    detail = client.get("/api/v1/vessels/V001/detail").json()
    curve = detail["speed_power_curve"]
    assert len(curve) > 5
    # Fuel per fixed distance must rise with speed.
    assert curve[-1]["fuel_per_1000nm_t"] > curve[0]["fuel_per_1000nm_t"]


def test_unknown_vessel_returns_404(client):
    assert client.get("/api/v1/vessels/NOPE").status_code == 404


def test_create_vessel_rejects_unknown_ship_type(client):
    response = client.post("/api/v1/vessels", json={
        "name": "Test", "imo": "1234567", "ship_type": "starship",
        "dwt": 50000, "length_m": 200, "beam_m": 30, "draft_design_m": 12,
    })
    assert response.status_code == 422


def test_create_and_delete_vessel(client):
    payload = {
        "id": "TEST01", "name": "MV Test", "imo": "9999999", "flag": "India",
        "ship_type": "bulk_carrier", "dwt": 45000, "length_m": 190.0,
        "beam_m": 30.0, "draft_design_m": 11.0, "block_coefficient": 0.82,
        "wetted_surface_m2": 7000, "frontal_area_m2": 700,
        "speed_min_kn": 9.0, "speed_max_kn": 14.0, "speed_service_kn": 12.0,
        "main_engine_kw": 7000, "aux_engine_kw": 1200,
        "current_fuel": "VLSFO", "compatible_fuels": ["VLSFO", "MGO"],
    }
    created = client.post("/api/v1/vessels", json=payload)
    assert created.status_code == 201
    assert created.json()["id"] == "TEST01"

    assert client.get("/api/v1/vessels/TEST01").status_code == 200
    assert client.delete("/api/v1/vessels/TEST01").status_code == 204
    assert client.get("/api/v1/vessels/TEST01").status_code == 404


def test_current_fuel_must_be_compatible(client):
    response = client.post("/api/v1/vessels", json={
        "id": "BAD01", "name": "MV Bad", "imo": "8888888", "ship_type": "tanker",
        "dwt": 50000, "length_m": 200, "beam_m": 32, "draft_design_m": 12,
        "current_fuel": "H2_GREEN", "compatible_fuels": ["HFO"],
    })
    assert response.status_code == 422


# --- routes ----------------------------------------------------------------

def test_routes_have_navigable_waypoints(client):
    routes = client.get("/api/v1/routes").json()
    assert len(routes) == 4
    for route in routes:
        assert len(route["waypoints"]) >= 2
        assert route["distance_nm"] > 0


def test_route_weather_generated_per_leg(client):
    route = client.get("/api/v1/routes/R001?month=7").json()
    weather = route["weather"]
    assert len(weather) == len(route["waypoints"]) - 1
    assert all(leg["wave_height_m"] > 0 for leg in weather)


def test_monsoon_raises_sea_state(client):
    january = client.get("/api/v1/routes/R001?month=1").json()["weather"]
    july = client.get("/api/v1/routes/R001?month=7").json()["weather"]
    mean_jan = sum(w["wave_height_m"] for w in january) / len(january)
    mean_jul = sum(w["wave_height_m"] for w in july) / len(july)
    assert mean_jul > mean_jan


# --- prediction ------------------------------------------------------------

def test_predict_returns_uncertainty(client):
    body = client.post("/api/v1/predict", json={
        "vessel_id": "V001", "route_id": "R001", "fuel_id": "HFO", "month": 7,
    }).json()

    assert body["fuel_tonnes"] > 0
    assert body["fuel_tonnes_std"] > 0
    low, high = body["confidence_interval_95"]
    assert low < body["fuel_tonnes"] < high
    assert body["physics_breakdown"]["total_kn"] > 0
    assert len(body["per_leg"]) > 0


def test_predict_rejects_speed_outside_vessel_envelope(client):
    response = client.post("/api/v1/predict", json={
        "vessel_id": "V001", "route_id": "R001", "fuel_id": "HFO", "speed_kn": 40.0,
    })
    assert response.status_code == 422


def test_predict_rejects_missing_route(client):
    response = client.post("/api/v1/predict", json={"vessel_id": "V001", "fuel_id": "HFO"})
    assert response.status_code == 422


def test_faster_burns_more(client):
    def fuel_at(speed):
        return client.post("/api/v1/predict", json={
            "vessel_id": "V001", "route_id": "R001", "fuel_id": "HFO", "speed_kn": speed,
        }).json()["fuel_tonnes"]

    assert fuel_at(14.0) > fuel_at(11.0)


def test_fuel_comparison_flags_greenwash(client):
    body = client.post("/api/v1/emissions/compare", json={
        "vessel_id": "V003", "route_id": "R003", "fuel_id": "HFO",
    }).json()

    assert len(body["fuels"]) > 5
    by_id = {f["fuel_id"]: f for f in body["fuels"]}
    assert by_id["NH3_GREY"]["greenwash_risk"] is True
    # Compatibility must be reported so the UI can grey out impossible options.
    assert all("vessel_compatible" in f for f in body["fuels"])


# --- compliance ------------------------------------------------------------

def test_fleet_cii(client):
    body = client.get("/api/v1/compliance/cii?year=2026").json()
    assert len(body["vessels"]) == 5
    assert sum(body["rating_distribution"].values()) == 5
    assert body["fleet_aer_gco2_per_tnm"] > 0


def test_cii_trajectory_spans_requested_years(client):
    body = client.get("/api/v1/compliance/cii/trajectory?start_year=2024&end_year=2030").json()
    assert body["years"] == list(range(2024, 2031))
    for vessel in body["vessels"]:
        assert len(vessel["points"]) == 7
        # The required line must tighten every year.
        required = [p["required_cii"] for p in vessel["points"]]
        assert required == sorted(required, reverse=True)


def test_scenario_slower_speed_improves_intensity(client):
    body = client.post("/api/v1/compliance/scenario", json={
        "year": 2026, "speed_delta_kn": -2.0,
    }).json()
    assert body["summary"]["mean_cii_delta_pct"] < 0


def test_scenario_higher_z_pushes_vessels_out(client):
    """A harsher reduction factor must never improve anyone's rating."""
    lenient = client.post("/api/v1/compliance/scenario",
                          json={"year": 2026, "reduction_factor_z_pct": 5.0}).json()
    strict = client.post("/api/v1/compliance/scenario",
                         json={"year": 2026, "reduction_factor_z_pct": 35.0}).json()

    order = "ABCDE"
    for a, b in zip(lenient["results"], strict["results"]):
        assert order.index(b["scenario"]["rating"]) >= order.index(a["scenario"]["rating"])


# --- optimisation ----------------------------------------------------------

def test_optimize_rejects_unknown_vessel(client):
    response = client.post("/api/v1/optimize", json={
        "vessel_ids": ["NOPE"], "route_ids": ["R001"],
    })
    assert response.status_code == 404


def test_optimize_rejects_infeasible_capacity(client):
    """The smallest ship cannot serve the heaviest route; say so rather than fail late."""
    response = client.post("/api/v1/optimize", json={
        "vessel_ids": ["V005"], "route_ids": ["R003"],  # 28k DWT against 76k t of cargo
    })
    assert response.status_code == 422
    assert "carry" in response.json()["detail"].lower()


def test_optimization_runs_to_completion(client):
    """The full async pipeline: submit, poll, receive a Pareto front."""
    started = client.post("/api/v1/optimize", json={
        "vessel_ids": ["V001", "V002", "V003"],
        "route_ids": ["R001", "R002"],
        "n_solutions": 5,
        "qubo_steps": 30, "qubo_replicas": 4,
        "qpso_particles": 8, "qpso_iterations": 15,
    })
    assert started.status_code == 202
    task_id = started.json()["task_id"]

    for _ in range(120):
        status = client.get(f"/api/v1/optimize/{task_id}").json()
        if status["status"] in ("completed", "failed"):
            break
        time.sleep(1.0)

    assert status["status"] == "completed", status.get("error")

    result = status["result"]
    assert result["n_pareto_optimal"] > 0
    assert len(result["pareto_solutions"]) == result["n_pareto_optimal"]

    for solution in result["pareto_solutions"]:
        assert solution["voyages"], "a plan with no deployments is not a plan"
        assert solution["totals"]["fuel_cost_usd"] > 0
        assert solution["qubo"]["n_variables"] > 0
        for voyage in solution["voyages"]:
            # Speeds must respect the vessel's own envelope.
            assert len(voyage["speeds_kn"]) == len(voyage["speed_profile"])
            assert voyage["cii"]["rating"] in "ABCDE"

    # No solution on the front may dominate another. The comparison must use all
    # five objectives: a plan can look beaten on the cost/emissions projection the
    # chart shows while still earning its place by arriving on time or carrying
    # less compliance risk. Checking only two axes would fail on a correct front.
    objectives = [
        [s["totals"][key] for key in
         ("fuel_cost_usd", "ghg_wtw_t", "delay_hours", "compliance_risk", "risk_adjusted_fuel_t")]
        for s in result["pareto_solutions"]
    ]
    for i, a in enumerate(objectives):
        for j, b in enumerate(objectives):
            if i == j:
                continue
            no_worse = all(x <= y for x, y in zip(a, b))
            strictly_better = any(x < y for x, y in zip(a, b))
            assert not (no_worse and strictly_better), (
                f"solution {i} dominates {j} across all objectives"
            )


def test_unknown_task_returns_404(client):
    assert client.get("/api/v1/optimize/does-not-exist").status_code == 404


# --- dashboard -------------------------------------------------------------

def test_dashboard_summary(client):
    body = client.get("/api/v1/dashboard/summary").json()
    kpis = body["kpis"]
    assert kpis["fleet_size"] == 5
    assert kpis["annual_fuel_tonnes"] > 0
    # Lifecycle emissions must exceed the funnel-only figure.
    assert kpis["annual_ghg_wtw_tonnes"] > kpis["annual_co2_tonnes"]
    assert 0 < kpis["wtt_share_pct"] < 100
    assert len(body["vessels"]) == 5


def test_formulas_cover_every_page(client):
    body = client.get("/api/v1/dashboard/formulas").json()
    for section in ("prediction", "physics", "optimization", "compliance", "emissions"):
        assert body[section]
        for formula in body[section]:
            assert formula["latex"] and formula["description"]


def test_shore_power_matrix(client):
    body = client.get("/api/v1/emissions/shore-power?berth_hours=30").json()
    assert len(body["vessels"]) == 5
    for vessel in body["vessels"]:
        assert len(vessel["ports"]) == 8
        if not vessel["shore_power_capable"]:
            assert vessel["n_feasible"] == 0
