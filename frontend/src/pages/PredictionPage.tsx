import { useEffect, useMemo, useState } from "react";
import FleetMap from "../components/common/FleetMap";
import FormulaDisplay from "../components/common/FormulaDisplay";
import LoadingSpinner, { EmptyState, ErrorState } from "../components/common/LoadingSpinner";
import Panel from "../components/common/Panel";
import ResistanceBars from "../components/prediction/ResistanceBars";
import UncertaintyChart from "../components/prediction/UncertaintyChart";
import FuelMatrix from "../components/prediction/FuelMatrix";
import { useAsync, usePrediction } from "../hooks/usePrediction";
import api from "../services/api";
import type { Formula, Route, Vessel } from "../types";
import { MONTHS } from "../utils/constants";
import { duration, int, num, pct, power, usd } from "../utils/formatters";

export function PredictionPage() {
  const fleet = useAsync(() => api.listVessels(), []);
  const routes = useAsync(() => api.listRoutes(), []);
  const formulas = useAsync<Record<string, Formula[]>>(() => api.formulas(), []);
  const { predict, result, comparison, loading, error } = usePrediction();

  const [vesselId, setVesselId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [fuelId, setFuelId] = useState("");
  const [speed, setSpeed] = useState(13);
  const [month, setMonth] = useState(7);
  const [samples, setSamples] = useState(40);

  const vessels = fleet.data ?? [];
  const routeList = routes.data ?? [];
  const vessel: Vessel | undefined = vessels.find((v) => v.id === vesselId);
  const route: Route | undefined = routeList.find((r) => r.id === routeId);

  // Seed the form once the catalogue arrives.
  useEffect(() => {
    if (!vesselId && vessels.length) {
      const first = vessels[0];
      setVesselId(first.id);
      setFuelId(first.current_fuel);
      setSpeed(first.speed_service_kn);
    }
  }, [vessels, vesselId]);

  useEffect(() => {
    if (!routeId && routeList.length) setRouteId(routeList[0].id);
  }, [routeList, routeId]);

  // Changing vessel must re-anchor the fuel and speed to what that hull allows.
  useEffect(() => {
    if (!vessel) return;
    if (!vessel.compatible_fuels.includes(fuelId)) setFuelId(vessel.current_fuel);
    setSpeed((current) =>
      Math.min(vessel.speed_max_kn, Math.max(vessel.speed_min_kn, current)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vesselId]);

  const run = () => {
    if (!vesselId || !routeId) return;
    predict({ vessel_id: vesselId, route_id: routeId, fuel_id: fuelId, speed_kn: speed, month, mc_samples: samples });
  };

  const speedSaving = useMemo(() => {
    if (!vessel || !result) return null;
    // Power scales roughly with the cube of speed, so express the marginal
    // trade-off the operator is actually making at this point on the curve.
    const ratio = (vessel.speed_service_kn / Math.max(speed, 1e-6)) ** 3;
    return { ratio, faster: speed > vessel.speed_service_kn };
  }, [vessel, result, speed]);

  if (fleet.loading || routes.loading) return <LoadingSpinner label="Loading fleet and routes" />;
  if (fleet.error) return <ErrorState message={fleet.error} onRetry={fleet.reload} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Panel title="Voyage" subtitle="Define what to predict">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="vessel">Vessel</label>
              <select
                id="vessel"
                className="field"
                value={vesselId}
                onChange={(e) => setVesselId(e.target.value)}
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="route">Route</label>
              <select
                id="route"
                className="field"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
              >
                {routeList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {int(r.distance_nm)} nm
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="fuel">Fuel</label>
              <select
                id="fuel"
                className="field"
                value={fuelId}
                onChange={(e) => setFuelId(e.target.value)}
              >
                {(vessel?.compatible_fuels ?? []).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <p className="text-2xs text-slate-600 mt-1">
                Only fuels this hull and engine can burn without a retrofit.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="speed">
                Speed
                <span className="metric text-slate-200 ml-2">{num(speed, 1)} kn</span>
              </label>
              <input
                id="speed"
                type="range"
                min={vessel?.speed_min_kn ?? 8}
                max={vessel?.speed_max_kn ?? 20}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <div className="flex justify-between text-2xs text-slate-600 mt-1 font-mono">
                <span>{num(vessel?.speed_min_kn ?? 8, 0)}</span>
                <span className="text-slate-500">
                  service {num(vessel?.speed_service_kn ?? 13, 1)}
                </span>
                <span>{num(vessel?.speed_max_kn ?? 20, 0)}</span>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="month">Season</label>
              <select
                id="month"
                className="field"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
              <p className="text-2xs text-slate-600 mt-1">
                Drives the monsoon sea state on Indian Ocean routes.
              </p>
            </div>

            <div>
              <label className="label" htmlFor="samples">
                Monte Carlo passes
                <span className="metric text-slate-200 ml-2">{samples}</span>
              </label>
              <input
                id="samples"
                type="range"
                min={10}
                max={120}
                step={10}
                value={samples}
                onChange={(e) => setSamples(Number(e.target.value))}
              />
              <p className="text-2xs text-slate-600 mt-1">
                Dropout passes used to separate model uncertainty from sensor noise.
              </p>
            </div>

            <button type="button" className="btn-primary w-full" onClick={run} disabled={loading}>
              {loading ? "Predicting" : "Predict fuel burn"}
            </button>

            {error && <p className="text-xs text-cii-e">{error}</p>}
          </div>
        </Panel>

        <div className="space-y-5">
          {loading && (
            <Panel><LoadingSpinner label="Running the model" /></Panel>
          )}

          {!loading && !result && (
            <Panel>
              <EmptyState
                title="No prediction yet"
                hint="Pick a vessel, route and speed, then predict. You will get a fuel figure with its uncertainty, the resistance behind it, and how every alternative fuel compares."
              />
            </Panel>
          )}

          {result && !loading && (
            <>
              <Panel
                title={`${result.vessel.name} on ${result.route.name}`}
                subtitle={`${int(result.distance_nm)} nm at ${num(speed, 1)} kn, ${MONTHS[month - 1]} conditions`}
                actions={
                  <span className="chip bg-navy-800 text-slate-400 border border-navy-600">
                    {result.mode === "neural" ? "Neural model" : "Physics model"}
                  </span>
                }
              >
                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Fuel required</p>
                    <p className="flex items-baseline gap-1.5">
                      <span className="metric text-3xl font-semibold text-teal">
                        {num(result.fuel_tonnes, 1)}
                      </span>
                      <span className="text-sm unit">t</span>
                    </p>
                    <p className="text-2xs text-slate-500 mt-1.5">
                      ± {num(result.fuel_tonnes_std, 1)} t at one standard deviation
                    </p>
                    <p className="text-2xs text-slate-600 mt-0.5 font-mono">
                      95% within {num(result.confidence_interval_95[0], 1)} –{" "}
                      {num(result.confidence_interval_95[1], 1)} t
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Bunker cost</p>
                    <p className="metric text-3xl font-semibold text-slate-50">
                      {usd(result.fuel_cost_usd, true)}
                    </p>
                    <p className="text-2xs text-slate-500 mt-1.5">
                      {duration(result.duration_hours)} at sea
                    </p>
                    <p className="text-2xs text-slate-600 mt-0.5">
                      {power(result.average_power_kw)} average propulsive load
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1.5">Model agreement</p>
                    <p className="metric text-3xl font-semibold text-slate-50">
                      {pct(result.model_divergence_pct)}
                    </p>
                    <p className="text-2xs text-slate-500 mt-1.5">
                      Neural {num(result.neural_estimate_tonnes ?? 0, 1)} t against physics{" "}
                      {num(result.physics_estimate_tonnes, 1)} t
                    </p>
                    {result.model_info.validation_mape_pct !== undefined && (
                      <p className="text-2xs text-slate-600 mt-0.5">
                        Validation error {pct(result.model_info.validation_mape_pct)}
                      </p>
                    )}
                  </div>
                </div>

                {speedSaving && Math.abs(speedSaving.ratio - 1) > 0.02 && (
                  <p className="mt-4 pt-4 border-t border-navy-700/70 text-xs text-slate-400 leading-relaxed">
                    At {num(speed, 1)} kn this voyage needs{" "}
                    <span className="metric text-slate-200">
                      {speedSaving.faster ? `${num(1 / speedSaving.ratio, 2)}×` : `${num(1 / speedSaving.ratio, 2)}×`}
                    </span>{" "}
                    the propulsive power of the same voyage at the service speed of{" "}
                    {num(vessel?.speed_service_kn ?? 0, 1)} kn. Power tracks roughly the cube of
                    speed, which is why a knot either way moves the fuel bill so sharply.
                  </p>
                )}
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel
                  title="Where the resistance comes from"
                  subtitle="Energy-weighted across the voyage"
                >
                  <ResistanceBars breakdown={result.physics_breakdown} />
                </Panel>

                <Panel title="Fuel rate along the track" subtitle="Shaded band is the 95% interval">
                  <UncertaintyChart legs={result.per_leg} weather={result.weather} />
                </Panel>
              </div>

              <Panel
                title="Route and conditions"
                subtitle="Legs coloured by sea state"
                bodyClassName="p-0"
              >
                <FleetMap
                  routes={route ? [{ ...route, weather: result.weather }] : []}
                  ports={[]}
                  height="340px"
                  colorByWeather
                />
              </Panel>

              {comparison && (
                <Panel
                  title="If this voyage ran on a different fuel"
                  subtitle={`Same propulsive energy, compared against ${comparison.baseline_fuel} on a Well-to-Wake basis`}
                  bodyClassName="p-0"
                >
                  <FuelMatrix comparison={comparison} />
                </Panel>
              )}
            </>
          )}
        </div>
      </div>

      {formulas.data && (
        <FormulaDisplay
          formulas={[...(formulas.data.prediction ?? []), ...(formulas.data.physics ?? [])]}
        />
      )}
    </div>
  );
}

export default PredictionPage;
