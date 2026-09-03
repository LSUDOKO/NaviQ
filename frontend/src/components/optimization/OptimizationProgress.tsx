import { chart } from "../../utils/chartTheme";
import Plot from "react-plotly.js";
import type { OptimizationProgressEvent } from "../../types";
import { num, pct } from "../../utils/formatters";

/**
 * Live telemetry from the two solvers.
 *
 * This exists to show the optimisation is real. The temperature and transverse
 * field decaying together, the acceptance rate falling as the system freezes,
 * the swarm's diversity collapsing as it converges -- these are the signatures
 * of an actual anneal and an actual swarm, and none of them appear if the
 * numbers are faked.
 */
export function OptimizationProgress({
  events,
  progress,
  message,
}: {
  events: OptimizationProgressEvent[];
  progress: number;
  message: string;
}) {
  const qubo = events.filter((e) => e.phase === "qubo" && e.temperature !== undefined);
  const qpso = events.filter((e) => e.phase === "qpso" && e.best_fitness !== undefined);

  const latestQubo = qubo[qubo.length - 1];
  const latestQpso = qpso[qpso.length - 1];
  const totalTunneling = qubo.reduce((sum, e) => sum + (e.tunneling_events ?? 0), 0);

  const axis = {
    gridcolor: chart.grid,
    zerolinecolor: chart.zero,
    titlefont: { size: 10 },
    tickfont: { size: 9 },
  };
  const layoutBase = {
    autosize: true,
    height: 190,
    margin: { l: 46, r: 40, t: 8, b: 32 },
    paper_bgcolor: chart.paper,
    plot_bgcolor: chart.paper,
    font: { color: "#6B7280", size: 10, family: "Inter, sans-serif" },
    showlegend: false,
    hoverlabel: chart.hover,
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-txt-secondary">{message || "Working"}</span>
          <span className="metric text-xs text-signal">{pct(progress * 100, 0)}</span>
        </div>
        <div className="h-1.5 bg-ink-800 rounded-sm overflow-hidden">
          <div
            className="h-full bg-signal transition-all duration-300"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Temperature",
            value: latestQubo ? num(latestQubo.temperature ?? 0, 3) : "—",
            hint: "cooling",
          },
          {
            label: "Transverse field",
            value: latestQubo ? num(latestQubo.transverse_field ?? 0, 3) : "—",
            hint: "Γ, quantum term",
          },
          {
            label: "Tunnelling events",
            value: totalTunneling > 0 ? String(totalTunneling) : "—",
            hint: "barrier crossings",
          },
          {
            label: "Swarm diversity",
            value: latestQpso ? num(latestQpso.swarm_diversity ?? 0, 2) : "—",
            hint: "spread of particles",
          },
        ].map((stat) => (
          <div key={stat.label} className="border border-ink-700/60 rounded-sm px-3 py-2">
            <p className="text-2xs text-txt-tertiary">{stat.label}</p>
            <p className="metric text-base text-txt-primary mt-0.5">{stat.value}</p>
            <p className="text-2xs text-txt-quiet">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs text-txt-secondary mb-1.5">Annealing schedule</p>
          {qubo.length > 1 ? (
            <Plot
              data={[
                {
                  y: qubo.map((e) => e.temperature ?? 0),
                  type: "scatter",
                  mode: "lines",
                  name: "Temperature",
                  line: { color: chart.amber, width: 2 },
                },
                {
                  y: qubo.map((e) => e.transverse_field ?? 0),
                  type: "scatter",
                  mode: "lines",
                  name: "Transverse field",
                  line: { color: chart.accent, width: 2 },
                  yaxis: "y2",
                },
              ]}
              layout={{
                ...layoutBase,
                xaxis: { ...axis, title: { text: "Sweep" } },
                yaxis: { ...axis, title: { text: "T" }, color: chart.amber },
                yaxis2: {
                  ...axis,
                  title: { text: "Γ" },
                  overlaying: "y",
                  side: "right",
                  color: chart.accent,
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
              useResizeHandler
            />
          ) : (
            <div className="h-[190px] flex items-center justify-center text-2xs text-txt-quiet">
              Waiting for the first sweep
            </div>
          )}
          <p className="text-2xs text-txt-quiet leading-relaxed mt-1">
            Both decay together. While Γ is high the replicas roam independently and can tunnel
            through barriers; as it falls they condense onto one answer.
          </p>
        </div>

        <div>
          <p className="text-xs text-txt-secondary mb-1.5">Swarm convergence</p>
          {qpso.length > 1 ? (
            <Plot
              data={[
                {
                  y: qpso.map((e) => e.best_fitness ?? 0),
                  type: "scatter",
                  mode: "lines",
                  name: "Best",
                  line: { color: chart.accent, width: 2 },
                },
                {
                  y: qpso.map((e) => e.swarm_diversity ?? 0),
                  type: "scatter",
                  mode: "lines",
                  name: "Diversity",
                  line: { color: chart.sky, width: 1.5, dash: "dot" },
                  yaxis: "y2",
                },
              ]}
              layout={{
                ...layoutBase,
                xaxis: { ...axis, title: { text: "Iteration" } },
                yaxis: { ...axis, title: { text: "Objective" }, color: chart.accent },
                yaxis2: {
                  ...axis,
                  title: { text: "Spread" },
                  overlaying: "y",
                  side: "right",
                  color: chart.sky,
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%" }}
              useResizeHandler
            />
          ) : (
            <div className="h-[190px] flex items-center justify-center text-2xs text-txt-quiet">
              Speed optimisation starts after the first assignment
            </div>
          )}
          <p className="text-2xs text-txt-quiet leading-relaxed mt-1">
            The objective falls as the spread collapses: particles are sampled from wells that
            tighten around the best solution found so far.
          </p>
        </div>
      </div>
    </div>
  );
}

export default OptimizationProgress;
