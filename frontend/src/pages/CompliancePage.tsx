import { chart } from "../utils/chartTheme";
import { useState } from "react";
import Plot from "react-plotly.js";
import { CIIBadge, CIIRail } from "../components/common/CIIRail";
import FormulaDisplay from "../components/common/FormulaDisplay";
import LoadingSpinner, { ErrorState } from "../components/common/LoadingSpinner";
import Panel from "../components/common/Panel";
import SEEMPPanel from "../components/compliance/SEEMPPanel";
import { useAsync } from "../hooks/usePrediction";
import api from "../services/api";
import type { CIIRating, Formula } from "../types";
import { int, num, pct } from "../utils/formatters";

interface TrajectoryPoint {
  year: number;
  attained_cii: number;
  required_cii: number;
  rating: CIIRating;
  boundaries: Record<string, number>;
  is_compliant: boolean;
  margin_pct: number;
}

interface TrajectoryVessel {
  vessel_id: string;
  vessel_name: string;
  ship_type: string;
  points: TrajectoryPoint[];
  first_non_compliant_year: number | null;
}

export function CompliancePage() {
  const [year, setYear] = useState(2026);
  const [zOverride, setZOverride] = useState<number | null>(null);
  const [speedDelta, setSpeedDelta] = useState(0);

  const fleet = useAsync(() => api.fleetCII(year), [year]);
  const trajectory = useAsync<{ years: number[]; vessels: TrajectoryVessel[] }>(
    () => api.ciiTrajectory(2023, 2032),
    [],
  );
  const formulas = useAsync<Record<string, Formula[]>>(() => api.formulas(), []);

  const [scenario, setScenario] = useState<Record<string, unknown> | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);

  const runScenario = async () => {
    setScenarioLoading(true);
    try {
      const payload: Record<string, unknown> = { year, speed_delta_kn: speedDelta };
      if (zOverride !== null) payload.reduction_factor_z_pct = zOverride;
      setScenario(await api.ciiScenario(payload));
    } finally {
      setScenarioLoading(false);
    }
  };

  if (fleet.loading) return <LoadingSpinner label="Calculating carbon intensity" />;
  if (fleet.error) return <ErrorState message={fleet.error} onRetry={fleet.reload} />;
  if (!fleet.data) return null;

  const data = fleet.data;
  const atRisk = data.vessels.filter((v) => !v.cii.is_compliant || v.cii.rating === "D");
  const firstBreaches = (trajectory.data?.vessels ?? [])
    .filter((v) => v.first_non_compliant_year !== null)
    .sort((a, b) => (a.first_non_compliant_year ?? 0) - (b.first_non_compliant_year ?? 0));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Fleet carbon intensity",
            value: num(data.fleet_aer_gco2_per_tnm, 2),
            unit: "gCO₂/t·nm",
            hint: `${int(data.fleet_co2_tonnes)} t CO₂ a year`,
          },
          {
            label: "Compliant",
            value: `${data.n_compliant}/${data.n_compliant + data.n_non_compliant}`,
            hint: data.n_non_compliant > 0 ? "Action required below" : "No action required",
          },
          {
            label: "Required reduction",
            value: pct(data.reduction_factor_z_pct, 0),
            hint: `Z factor for ${year}, against the 2019 line`,
          },
          {
            label: "First breach ahead",
            value: firstBreaches.length ? String(firstBreaches[0].first_non_compliant_year) : "—",
            hint: firstBreaches.length
              ? `${firstBreaches[0].vessel_name} slips first`
              : "None within the decade",
          },
        ].map((stat) => (
          <div key={stat.label} className="panel px-4 py-3.5">
            <p className="text-xs text-txt-tertiary mb-2">{stat.label}</p>
            <p className="flex items-baseline gap-1.5">
              <span className="metric text-2xl font-semibold text-txt-primary">{stat.value}</span>
              {stat.unit && <span className="text-xs unit">{stat.unit}</span>}
            </p>
            <p className="text-2xs text-txt-quiet mt-1.5">{stat.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Where each vessel sits"
          subtitle={`Attained intensity against the ${year} A–E boundaries`}
          className="lg:col-span-2"
        >
          <div className="space-y-5">
            {data.vessels.map((entry) => (
              <div key={entry.vessel_id}>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CIIBadge rating={entry.cii.rating} size="sm" />
                    <span className="text-sm text-txt-primary truncate">{entry.vessel_name}</span>
                  </div>
                  <div className="flex items-baseline gap-3 shrink-0">
                    <span className="metric text-xs text-txt-secondary">
                      {num(entry.cii.attained_cii, 2)}
                    </span>
                    <span
                      className={`metric text-2xs w-14 text-right ${
                        entry.cii.margin_to_c_boundary_pct < 5 ? "text-warn" : "text-txt-tertiary"
                      }`}
                      title="Headroom to the C boundary"
                    >
                      {pct(entry.cii.margin_to_c_boundary_pct, 0)}
                    </span>
                  </div>
                </div>
                <CIIRail
                  attained={entry.cii.attained_cii}
                  required={entry.cii.required_cii}
                  boundaries={entry.cii.boundaries}
                  rating={entry.cii.rating}
                  size="md"
                  showScale={false}
                />
              </div>
            ))}
          </div>
          <p className="text-2xs text-txt-quiet leading-relaxed mt-5 pt-4 border-t border-ink-700/70">
            The pale vertical line on each rail is the required intensity for {year}. The
            percentage is headroom to the C boundary — the point where a rating becomes a
            regulatory problem rather than a performance one.
          </p>
        </Panel>

        <Panel title="What if" subtitle="Test a policy or an operational change">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="year">Compliance year</label>
              <select
                id="year"
                className="field"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 8 }, (_, i) => 2025 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label flex items-baseline justify-between" htmlFor="z">
                <span>Reduction factor</span>
                <span className="metric text-txt-secondary">
                  {zOverride === null ? `${num(data.reduction_factor_z_pct, 0)}% statutory` : `${num(zOverride, 0)}%`}
                </span>
              </label>
              <input
                id="z"
                type="range"
                min={0}
                max={40}
                step={1}
                value={zOverride ?? data.reduction_factor_z_pct}
                onChange={(e) => setZOverride(Number(e.target.value))}
              />
              <p className="text-2xs text-txt-quiet mt-1 leading-snug">
                The IMO tightens this every year. Push it up to see which vessels fall out of
                compliance before they actually do.
              </p>
              {zOverride !== null && (
                <button
                  type="button"
                  className="text-2xs text-signal mt-1.5 hover:text-signal-bright"
                  onClick={() => setZOverride(null)}
                >
                  Back to statutory
                </button>
              )}
            </div>

            <div>
              <label className="label flex items-baseline justify-between" htmlFor="speed">
                <span>Speed change</span>
                <span className="metric text-txt-secondary">
                  {speedDelta > 0 ? "+" : ""}{num(speedDelta, 1)} kn
                </span>
              </label>
              <input
                id="speed"
                type="range"
                min={-4}
                max={2}
                step={0.5}
                value={speedDelta}
                onChange={(e) => setSpeedDelta(Number(e.target.value))}
              />
              <p className="text-2xs text-txt-quiet mt-1 leading-snug">
                Slow steaming is the fastest lever available: propulsive power tracks roughly the
                cube of speed.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary w-full"
              onClick={runScenario}
              disabled={scenarioLoading}
            >
              {scenarioLoading ? "Calculating" : "Test this scenario"}
            </button>

            {scenario && (
              <div className="pt-4 border-t border-ink-700/70 space-y-2.5">
                {(scenario.results as Array<Record<string, never>>).map((entry) => {
                  const record = entry as unknown as {
                    vessel_id: string;
                    vessel_name: string;
                    baseline: { rating: CIIRating };
                    scenario: { rating: CIIRating };
                    cii_delta_pct: number;
                    rating_changed: boolean;
                  };
                  return (
                    <div key={record.vessel_id} className="flex items-center gap-2.5 text-xs">
                      <span className="text-txt-secondary flex-1 truncate">{record.vessel_name}</span>
                      <CIIBadge rating={record.baseline.rating} size="sm" />
                      <span className="text-txt-quiet" aria-hidden="true">→</span>
                      <CIIBadge rating={record.scenario.rating} size="sm" />
                      <span
                        className={`metric text-2xs w-14 text-right ${
                          record.cii_delta_pct < 0 ? "text-cii-a" : "text-cii-e"
                        }`}
                      >
                        {record.cii_delta_pct > 0 ? "+" : ""}
                        {num(record.cii_delta_pct, 1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {trajectory.data && (
        <Panel
          title="The line moves even when the ship does not"
          subtitle="Attained intensity held constant against a required line that tightens every year"
        >
          <Plot
            data={[
              ...trajectory.data.vessels.map((vessel, index) => ({
                x: vessel.points.map((p) => p.year),
                y: vessel.points.map((p) => p.attained_cii / p.required_cii),
                type: "scatter" as const,
                mode: "lines+markers" as const,
                name: vessel.vessel_name,
                line: {
                  width: 2,
                  color: [chart.accent, chart.sky, chart.amber, chart.violet, "#65A30D"][index % 5],
                },
                marker: { size: 5 },
                hovertemplate: `<b>${vessel.vessel_name}</b><br>%{x}: %{y:.2f}× required<extra></extra>`,
              })),
              {
                x: trajectory.data.years,
                y: trajectory.data.years.map(() => 1.06),
                type: "scatter" as const,
                mode: "lines" as const,
                name: "C boundary",
                line: { color: chart.red, width: 1.5, dash: "dash" },
                hovertemplate: "Compliance limit<extra></extra>",
              },
            ]}
            layout={{
              autosize: true,
              height: 320,
              margin: { l: 62, r: 18, t: 12, b: 44 },
              paper_bgcolor: chart.paper,
              plot_bgcolor: chart.paper,
              font: { color: "#6B7280", size: 11, family: "Inter, sans-serif" },
              xaxis: { title: { text: "Year", font: { size: 11 } }, gridcolor: chart.grid, dtick: 1 },
              yaxis: {
                title: { text: "Attained ÷ required", font: { size: 11 } },
                gridcolor: chart.grid,
                zerolinecolor: chart.zero,
              },
              legend: { orientation: "h", y: -0.2, font: { size: 10 } },
              hoverlabel: chart.hover,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%" }}
            useResizeHandler
          />
          <p className="text-2xs text-txt-quiet leading-relaxed mt-2">
            Plotted as a ratio, so one line per vessel is directly comparable. Anything above the
            dashed line is out of compliance. Every curve rises without a single operational change,
            because the denominator shrinks as the reduction factor climbs toward 2030.
          </p>
        </Panel>
      )}

      {atRisk.length > 0 && (
        <SEEMPPanel vessels={atRisk} />
      )}

      {formulas.data && <FormulaDisplay formulas={formulas.data.compliance ?? []} />}
    </div>
  );
}

export default CompliancePage;
