import { CIIBadge } from "../common/CIIRail";
import FleetMap from "../common/FleetMap";
import Panel from "../common/Panel";
import SpeedProfile from "./SpeedProfile";
import type { ParetoSolution, VoyagePlan } from "../../types";
import { FUEL_SHORT, OBJECTIVE_LABELS } from "../../utils/constants";
import { duration, int, num, probability, tonnes, usd } from "../../utils/formatters";
import { useState } from "react";

export function SolutionDetail({ solution }: { solution: ParetoSolution }) {
  const [activeVoyage, setActiveVoyage] = useState(0);
  const voyage: VoyagePlan | undefined = solution.voyages[activeVoyage];

  return (
    <div className="space-y-5">
      <Panel
        title={`${solution.solution_id} — ${solution.label}`}
        subtitle={`${solution.voyages.length} vessel deployments, ranked ${solution.pareto_rank === 0 ? "on the frontier" : `rank ${solution.pareto_rank + 1}`}`}
        actions={
          solution.all_compliant ? (
            <span className="chip bg-cii-a/12 text-cii-a border border-cii-a/30">
              All compliant
            </span>
          ) : (
            <span className="chip bg-cii-e/12 text-cii-e border border-cii-e/30">
              Compliance risk
            </span>
          )
        }
      >
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Fuel cost", value: usd(solution.totals.fuel_cost_usd, true) },
            { label: "Lifecycle CO₂e", value: tonnes(solution.totals.ghg_wtw_t, 0) },
            { label: "At the funnel", value: tonnes(solution.totals.co2_ttw_t, 0) },
            { label: "Schedule delay", value: `${num(solution.totals.delay_hours, 1)} h` },
            { label: "Compliance risk", value: probability(solution.totals.compliance_risk) },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xs text-slate-500 mb-1">{stat.label}</p>
              <p className="metric text-lg text-slate-50">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-navy-700/70">
          <p className="text-xs text-slate-500 mb-2.5">
            What this plan optimised for
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(solution.weights)
              .filter(([, weight]) => weight > 0.01)
              .sort(([, a], [, b]) => b - a)
              .map(([key, weight]) => (
                <span
                  key={key}
                  className="chip bg-navy-800 border border-navy-600 text-slate-300"
                  title={`Weight ${num(weight * 100, 0)}%`}
                >
                  {OBJECTIVE_LABELS[key] ?? key}
                  <span className="metric text-slate-500">{num(weight * 100, 0)}%</span>
                </span>
              ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-navy-700/70 grid gap-3 sm:grid-cols-4 text-2xs">
          {[
            { label: "QUBO variables", value: int(solution.qubo.n_variables) },
            { label: "Annealing sweeps", value: int(solution.qubo.steps_run) },
            { label: "Trotter replicas", value: int(solution.qubo.replicas) },
            { label: "Tunnelling events", value: int(solution.qubo.tunneling_events) },
          ].map((stat) => (
            <div key={stat.label}>
              <span className="text-slate-600">{stat.label} </span>
              <span className="metric text-slate-400">{stat.value}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Deployment" subtitle="Which vessel sails which route, on what fuel" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-2xs text-slate-500 border-b border-navy-700/70">
                <th className="text-left font-medium px-4 py-2.5">Vessel</th>
                <th className="text-left font-medium px-4 py-2.5">Route</th>
                <th className="text-left font-medium px-4 py-2.5">Fuel</th>
                <th className="text-right font-medium px-4 py-2.5 hidden sm:table-cell">Avg speed</th>
                <th className="text-right font-medium px-4 py-2.5 hidden md:table-cell">Passage</th>
                <th className="text-right font-medium px-4 py-2.5">Fuel</th>
                <th className="text-center font-medium px-4 py-2.5 hidden lg:table-cell">Shore power</th>
                <th className="text-center font-medium px-4 py-2.5">CII</th>
              </tr>
            </thead>
            <tbody>
              {solution.voyages.map((v, index) => (
                <tr
                  key={`${v.vessel_id}-${v.route_id}`}
                  onClick={() => setActiveVoyage(index)}
                  className={`border-b border-navy-800/70 last:border-0 cursor-pointer transition-colors ${
                    index === activeVoyage ? "bg-navy-850" : "hover:bg-navy-850/40"
                  }`}
                >
                  <td className="px-4 py-3 text-slate-200">{v.vessel_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{v.route_name}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {FUEL_SHORT[v.fuel_id] ?? v.fuel_id}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-slate-300 hidden sm:table-cell">
                    {num(v.voyage_totals.average_speed_kn, 1)} kn
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-slate-400 hidden md:table-cell">
                    {duration(v.voyage_totals.total_duration_hours)}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-slate-200">
                    {num(Number(v.objectives.fuel_mass_t ?? 0), 1)} t
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {v.shore_power.selected ? (
                      <span className="chip bg-cii-a/12 text-cii-a border border-cii-a/30">on</span>
                    ) : (
                      <span className="text-2xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <CIIBadge rating={v.cii.rating} size="sm" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {voyage && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title={`Speed plan — ${voyage.vessel_name}`}
            subtitle={`${voyage.route_name}, ${int(voyage.distance_nm)} nm`}
          >
            <SpeedProfile legs={voyage.speed_profile} />
            <p className="text-2xs text-slate-600 leading-relaxed mt-2">
              Speed is set per leg, not once for the passage. Where the sea builds, holding speed
              would cost more fuel than the schedule saves, so the optimiser eases off and makes
              the time back in calmer water.
            </p>
          </Panel>

          <Panel
            title="Track"
            subtitle="Coloured by commanded speed, teal slow to amber fast"
            bodyClassName="p-0"
          >
            <FleetMap
              routes={[
                {
                  id: voyage.route_id,
                  name: voyage.route_name,
                  origin_port: "",
                  destination_port: "",
                  distance_nm: voyage.distance_nm,
                  cargo_demand_t: 0,
                  revenue_usd: 0,
                  eta_window_hours: [],
                  waypoints: voyage.route_waypoints,
                },
              ]}
              ports={[]}
              height="330px"
              speedProfile={{
                routeId: voyage.route_id,
                speeds: voyage.speeds_kn,
                min: Math.min(...voyage.speeds_kn),
                max: Math.max(...voyage.speeds_kn),
              }}
            />
          </Panel>
        </div>
      )}

      {voyage?.shore_power.detail && (
        <Panel
          title="Shore power at berth"
          subtitle={`${voyage.shore_power.detail.port_name}, ${num(voyage.shore_power.detail.berth_hours, 0)} hours alongside`}
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-2xs text-slate-500 mb-1">Running auxiliaries</p>
              <p className="metric text-lg text-slate-200">
                {tonnes(voyage.shore_power.detail.auxiliary_option.ghg_wtw_t, 2)}
              </p>
              <p className="text-2xs text-slate-600">
                {usd(voyage.shore_power.detail.auxiliary_option.cost_usd)}
              </p>
            </div>
            <div>
              <p className="text-2xs text-slate-500 mb-1">Drawing from the grid</p>
              <p className="metric text-lg text-slate-200">
                {tonnes(voyage.shore_power.detail.shore_power_option.ghg_wtw_t, 2)}
              </p>
              <p className="text-2xs text-slate-600">
                {usd(voyage.shore_power.detail.shore_power_option.cost_usd)} at{" "}
                {int(voyage.shore_power.detail.shore_power_option.grid_ci_gco2_per_kwh)} gCO₂/kWh
              </p>
            </div>
            <div>
              <p className="text-2xs text-slate-500 mb-1">Decision</p>
              <p
                className={`metric text-lg ${
                  voyage.shore_power.selected ? "text-cii-a" : "text-slate-400"
                }`}
              >
                {voyage.shore_power.selected ? "Connect" : "Stay on auxiliaries"}
              </p>
              <p className="text-2xs text-slate-600">
                {voyage.shore_power.detail.ghg_saving_wtw_t > 0
                  ? `Saves ${num(voyage.shore_power.detail.ghg_saving_wtw_t, 2)} t CO₂e`
                  : "No lifecycle benefit here"}
              </p>
            </div>
          </div>
          <p className="text-2xs text-slate-500 leading-relaxed mt-4 pt-3 border-t border-navy-700/70">
            {voyage.shore_power.detail.rationale}
          </p>
        </Panel>
      )}
    </div>
  );
}

export default SolutionDetail;
