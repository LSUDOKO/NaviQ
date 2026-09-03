import { useEffect, useMemo, useState } from "react";
import FormulaDisplay from "../components/common/FormulaDisplay";
import LoadingSpinner, { EmptyState, ErrorState } from "../components/common/LoadingSpinner";
import Panel from "../components/common/Panel";
import OptimizationProgress from "../components/optimization/OptimizationProgress";
import ParetoFront from "../components/optimization/ParetoFront";
import SolutionDetail from "../components/optimization/SolutionDetail";
import { useOptimization } from "../hooks/useOptimization";
import { useAsync } from "../hooks/usePrediction";
import api from "../services/api";
import type { Formula } from "../types";
import { MONTHS, OBJECTIVE_HINTS, OBJECTIVE_LABELS } from "../utils/constants";
import { num, pct, tonnes, usd } from "../utils/formatters";

const OBJECTIVES = ["fuel_cost", "ghg_wtw", "delay", "compliance_risk", "risk_adjusted_fuel"] as const;

export function OptimizationPage() {
  const fleet = useAsync(() => api.listVessels(), []);
  const routes = useAsync(() => api.listRoutes(), []);
  const formulas = useAsync<Record<string, Formula[]>>(() => api.formulas(), []);
  const optimization = useOptimization();

  const [vesselIds, setVesselIds] = useState<string[]>([]);
  const [routeIds, setRouteIds] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({
    fuel_cost: 0.3,
    ghg_wtw: 0.3,
    delay: 0.15,
    compliance_risk: 0.15,
    risk_adjusted_fuel: 0.1,
  });
  const [nSolutions, setNSolutions] = useState(12);
  const [month, setMonth] = useState(7);
  const [lambda, setLambda] = useState(1.0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Select the whole fleet and every route by default: the interesting
  // behaviour is combinatorial, and an empty selection shows none of it.
  useEffect(() => {
    if (fleet.data && vesselIds.length === 0) setVesselIds(fleet.data.map((v) => v.id));
  }, [fleet.data, vesselIds.length]);

  useEffect(() => {
    if (routes.data && routeIds.length === 0) setRouteIds(routes.data.map((r) => r.id));
  }, [routes.data, routeIds.length]);

  useEffect(() => {
    if (optimization.result?.pareto_solutions.length && !selectedId) {
      setSelectedId(optimization.result.pareto_solutions[0].solution_id);
      // A run takes long enough that the operator has usually scrolled away.
      // Bring the frontier back into view rather than leaving them to find it.
      window.requestAnimationFrame(() =>
        document
          .getElementById("pareto-front")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [optimization.result, selectedId]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  // Guard against a selection the optimiser cannot satisfy, and say why.
  const capacityWarning = useMemo(() => {
    if (!fleet.data || !routes.data || !vesselIds.length || !routeIds.length) return null;
    const largest = Math.max(
      ...fleet.data.filter((v) => vesselIds.includes(v.id)).map((v) => v.dwt),
      0,
    );
    const impossible = routes.data
      .filter((r) => routeIds.includes(r.id) && r.cargo_demand_t > largest)
      .map((r) => r.name);
    if (!impossible.length) return null;
    return `No selected vessel is large enough for ${impossible.join(" or ")}. Add a bigger ship or drop the route.`;
  }, [fleet.data, routes.data, vesselIds, routeIds]);

  const canRun = vesselIds.length > 0 && routeIds.length > 0 && !capacityWarning;

  const run = () => {
    setSelectedId(null);
    optimization.run({
      vessel_ids: vesselIds,
      route_ids: routeIds,
      weights,
      n_solutions: nSolutions,
      year: 2026,
      month,
      uncertainty_lambda: lambda,
      qubo_steps: 180,
      qubo_replicas: 8,
      qpso_particles: 24,
      qpso_iterations: 70,
    });
  };

  const result = optimization.result;
  const selected = result?.pareto_solutions.find((s) => s.solution_id === selectedId) ?? null;
  const dominated = result?.all_solutions.filter((s) => !s.is_pareto_optimal) ?? [];

  if (fleet.loading || routes.loading) return <LoadingSpinner label="Loading fleet and routes" />;
  if (fleet.error) return <ErrorState message={fleet.error} onRetry={fleet.reload} />;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <div className="space-y-5">
          <Panel title="What to plan" subtitle="Vessels and routes to deploy">
            <fieldset className="mb-4">
              <legend className="label">Vessels ({vesselIds.length} selected)</legend>
              <div className="space-y-1.5">
                {(fleet.data ?? []).map((vessel) => (
                  <label
                    key={vessel.id}
                    className="flex items-center gap-2.5 text-sm cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={vesselIds.includes(vessel.id)}
                      onChange={() => toggle(vesselIds, setVesselIds, vessel.id)}
                      className="accent-signal w-3.5 h-3.5"
                    />
                    <span className="text-txt-secondary group-hover:text-txt-primary transition-colors flex-1 truncate">
                      {vessel.name}
                    </span>
                    <span className="metric text-2xs text-txt-quiet">
                      {Math.round(vessel.dwt / 1000)}k
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="label">Routes ({routeIds.length} selected)</legend>
              <div className="space-y-1.5">
                {(routes.data ?? []).map((route) => (
                  <label
                    key={route.id}
                    className="flex items-center gap-2.5 text-sm cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={routeIds.includes(route.id)}
                      onChange={() => toggle(routeIds, setRouteIds, route.id)}
                      className="accent-signal w-3.5 h-3.5"
                    />
                    <span className="text-txt-secondary group-hover:text-txt-primary transition-colors flex-1 truncate">
                      {route.name}
                    </span>
                    <span className="metric text-2xs text-txt-quiet">
                      {Math.round(route.cargo_demand_t / 1000)}k t
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {capacityWarning && (
              <p className="text-2xs text-warn mt-4 leading-relaxed">{capacityWarning}</p>
            )}
          </Panel>

          <Panel title="What matters" subtitle="Relative weight on each objective">
            <div className="space-y-4">
              {OBJECTIVES.map((key) => (
                <div key={key}>
                  <label className="label flex items-baseline justify-between" htmlFor={key}>
                    <span>{OBJECTIVE_LABELS[key]}</span>
                    <span className="metric text-txt-secondary">{num(weights[key] * 100, 0)}%</span>
                  </label>
                  <input
                    id={key}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[key]}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
                    }
                  />
                  <p className="text-2xs text-txt-quiet mt-1 leading-snug">
                    {OBJECTIVE_HINTS[key]}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-ink-700/70 space-y-4">
              <div>
                <label className="label flex items-baseline justify-between" htmlFor="lambda">
                  <span>Risk aversion</span>
                  <span className="metric text-txt-secondary">λ = {num(lambda, 1)}</span>
                </label>
                <input
                  id="lambda"
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={lambda}
                  onChange={(e) => setLambda(Number(e.target.value))}
                />
                <p className="text-2xs text-txt-quiet mt-1 leading-snug">
                  How heavily to penalise a plan whose fuel burn is volatile under uncertain
                  weather. At zero, only the average matters.
                </p>
              </div>

              <div>
                <label className="label flex items-baseline justify-between" htmlFor="nsol">
                  <span>Plans to explore</span>
                  <span className="metric text-txt-secondary">{nSolutions}</span>
                </label>
                <input
                  id="nsol"
                  type="range"
                  min={5}
                  max={24}
                  step={1}
                  value={nSolutions}
                  onChange={(e) => setNSolutions(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="label" htmlFor="opt-month">Season</label>
                <select
                  id="opt-month"
                  className="field"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary w-full mt-5"
              onClick={run}
              disabled={!canRun || optimization.running || optimization.submitting}
            >
              {optimization.running ? "Optimising" : "Run optimisation"}
            </button>

            {optimization.error && (
              <p className="text-xs text-cii-e mt-3">{optimization.error}</p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          {optimization.running && (
            <Panel
              title="Solving"
              subtitle="Simulated quantum annealing for deployment, then quantum particle swarm for speed"
            >
              <OptimizationProgress
                events={optimization.events}
                progress={optimization.progress}
                message={optimization.latest?.message ?? "Starting"}
              />
            </Panel>
          )}

          {!optimization.running && !result && (
            <Panel>
              <EmptyState
                title="No plans yet"
                hint="Choose what to deploy and what matters, then run. The optimiser returns a set of plans that trade off against each other, not a single answer — because there isn't one."
              />
            </Panel>
          )}

          {result && (
            <>
              <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Plans on the frontier",
                    value: String(result.n_pareto_optimal),
                    hint: `from ${result.n_evaluated} evaluated`,
                  },
                  {
                    label: "Cost spread",
                    value: usd(result.front_summary.cost_saving_usd, true),
                    hint: `${pct(result.front_summary.cost_saving_pct, 0)} between cheapest and dearest`,
                  },
                  {
                    label: "Emissions spread",
                    value: tonnes(result.front_summary.ghg_saving_t, 0),
                    hint: `${pct(result.front_summary.ghg_saving_pct, 0)} between cleanest and dirtiest`,
                  },
                  {
                    label: "Solve time",
                    value: `${num(result.runtime_seconds, 1)}s`,
                    hint: "on classical hardware",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="panel px-4 py-3">
                    <p className="text-2xs text-txt-tertiary mb-1.5">{stat.label}</p>
                    <p className="metric text-xl text-txt-primary">{stat.value}</p>
                    <p className="text-2xs text-txt-quiet mt-1">{stat.hint}</p>
                  </div>
                ))}
              </section>

              <Panel
                title="The trade-off"
                subtitle="Every plan on this curve is optimal for some priority. Click one to see it in full."
                className="scroll-mt-4"
                id="pareto-front"
              >
                <ParetoFront
                  solutions={result.pareto_solutions}
                  dominated={dominated}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <p className="text-2xs text-txt-quiet leading-relaxed mt-2">
                  Points are coloured by the worst carbon intensity rating in the plan. Hollow
                  markers are plans another plan beats on every objective at once — they are shown
                  so the shape of the frontier is visible, not because anyone would choose them.
                </p>
              </Panel>

              {selected && <SolutionDetail solution={selected} />}
            </>
          )}
        </div>
      </div>

      {formulas.data && <FormulaDisplay formulas={formulas.data.optimization ?? []} />}
    </div>
  );
}

export default OptimizationPage;
