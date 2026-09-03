import { useState } from "react";
import Plot from "react-plotly.js";
import { Link } from "react-router-dom";
import FleetGauge from "../components/dashboard/FleetGauge";
import { CIIBadge, CIIRail } from "../components/common/CIIRail";
import FleetMap from "../components/common/FleetMap";
import LoadingSpinner, { ErrorState } from "../components/common/LoadingSpinner";
import MetricCard from "../components/common/MetricCard";
import Panel from "../components/common/Panel";
import { useAsync } from "../hooks/usePrediction";
import api from "../services/api";
import type { CIIRating } from "../types";
import { chart, axis } from "../utils/chartTheme";
import { ratingBoundaries } from "../utils/cii";
import { CII_COLORS, SHIP_TYPE_LABELS } from "../utils/constants";
import { int, num, pct, tonnes, usd } from "../utils/formatters";

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONS = {
  fuel: <svg viewBox="0 0 20 20" className="w-4 h-4" {...s}><path d="M5 4h7v13H5zM12 8h2.5v6a1.5 1.5 0 0 0 3 0V8l-2-2M7 7h3"/></svg>,
  cloud: <svg viewBox="0 0 20 20" className="w-4 h-4" {...s}><path d="M6 15.5a3.5 3.5 0 0 1-.4-7 5 5 0 0 1 9.6 1.2A3 3 0 0 1 15 15.5z"/></svg>,
  shield: <svg viewBox="0 0 20 20" className="w-4 h-4" {...s}><path d="M10 2.5 16.5 5v5c0 4-2.8 6.4-6.5 7.5C6.3 16.4 3.5 14 3.5 10V5z"/><path d="M7.5 10l1.8 1.8L13 8"/></svg>,
  coins: <svg viewBox="0 0 20 20" className="w-4 h-4" {...s}><ellipse cx="10" cy="6" rx="6" ry="2.5"/><path d="M4 6v8c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5"/></svg>,
};

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() => api.dashboardSummary(2026), []);
  const [basis, setBasis] = useState<"funnel" | "lifecycle">("lifecycle");

  if (loading) return <LoadingSpinner label="Reading fleet data" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { kpis, vessels, routes, ports } = data;
  const compliantPct = Math.round((kpis.compliant_vessels / Math.max(kpis.fleet_size, 1)) * 100);
  const tightest = [...vessels].sort((a, b) => a.margin_pct - b.margin_pct)[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Per-vessel emissions on the chosen basis. Lifecycle is scaled from the
  // fleet-wide upstream share, which the summary endpoint reports.
  const lifecycleFactor = kpis.annual_ghg_wtw_tonnes / Math.max(kpis.annual_co2_tonnes, 1);
  const bars = vessels.map((v) => ({ name: v.name.replace(/^MV /, ""), value: basis === "funnel" ? v.annual_co2_t : v.annual_co2_t * lifecycleFactor }));
  const peak = bars.reduce((m, b, i) => (b.value > bars[m].value ? i : m), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold text-txt-primary tracking-[-0.02em]">Welcome back, operator</h2>
          <p className="text-sm text-txt-tertiary mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="btn btn-ghost text-sm">Compliance year 2026
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-txt-quiet" {...s}><path d="m6 8 4 4 4-4"/></svg></span>
          <a className="btn btn-ghost text-sm" href="/api/v1/dashboard/summary" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" {...s}><path d="M10 12V3M6.5 6.5 10 3l3.5 3.5M4 12v4h12v-4"/></svg>Export</a>
        </div>
      </div>

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ICONS.fuel} label="Annual fuel burn" value={int(kpis.annual_fuel_tonnes)} unit="t"
          delta={{ text: usd(kpis.annual_fuel_cost_usd, true), tone: "neutral" }} hint="at current bunker prices" />
        <MetricCard icon={ICONS.cloud} label="Lifecycle emissions" value={int(kpis.annual_ghg_wtw_tonnes)} unit="t CO₂e"
          delta={{ text: `${pct(kpis.wtt_share_pct, 0)} upstream`, tone: "warn" }} hint="before fuel reaches a tank" />
        <MetricCard icon={ICONS.shield} label="Within CII limits" value={`${kpis.compliant_vessels}/${kpis.fleet_size}`}
          delta={{ text: kpis.at_risk_vessels > 0 ? `${kpis.at_risk_vessels} at risk` : "All C or better", tone: kpis.at_risk_vessels > 0 ? "bad" : "good" }}
          hint={`tightest margin ${pct(tightest?.margin_pct ?? 0, 1)}`} />
        <MetricCard icon={ICONS.coins} label="Savings identified" value={kpis.realised_cost_saving_usd > 0 ? usd(kpis.realised_cost_saving_usd, true) : "—"}
          delta={kpis.optimizations_run > 0 ? { text: `${tonnes(kpis.realised_ghg_saving_t, 0)} CO₂e`, tone: "good" } : { text: "No runs yet", tone: "neutral" }}
          hint={kpis.optimizations_run > 0 ? `across ${kpis.optimizations_run} optimisation${kpis.optimizations_run === 1 ? "" : "s"}` : "run an optimisation"} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel bodyClassName="px-5 pb-3 pt-0">
          <div className="flex flex-wrap items-start justify-between gap-3 pt-5 pb-1">
            <div>
              <h2 className="panel-title">Emissions by vessel</h2>
              <p className="flex items-baseline gap-2 mt-2">
                <span className="metric metric-lg">{int(basis === "funnel" ? kpis.annual_co2_tonnes : kpis.annual_ghg_wtw_tonnes)}</span>
                <span className="text-xs unit">t CO₂e a year</span>
                <span className="pill pill-good ml-1">{kpis.compliant_vessels}/{kpis.fleet_size} compliant</span>
              </p>
            </div>
            <div className="seg" role="group" aria-label="Accounting basis">
              <button type="button" aria-pressed={basis === "funnel"} onClick={() => setBasis("funnel")}>At the funnel</button>
              <button type="button" aria-pressed={basis === "lifecycle"} onClick={() => setBasis("lifecycle")}>Lifecycle</button>
            </div>
          </div>
          <Plot
            data={[{
              x: bars.map((b) => b.name), y: bars.map((b) => b.value), type: "bar",
              marker: { color: bars.map((_, i) => (i === peak ? chart.accent : "#E3E8F0")), line: { width: 0 } },
              width: 0.55,
              hovertemplate: "%{x}<br>%{y:,.0f} t CO₂e<extra></extra>",
              text: bars.map((b, i) => (i === peak ? `${int(b.value)} t` : "")), textposition: "outside",
              textfont: { color: chart.accent, size: 11, family: chart.font.family },
              cliponaxis: false,
            }]}
            layout={{ autosize: true, height: 250, margin: { l: 44, r: 8, t: 24, b: 36 }, paper_bgcolor: chart.paper, plot_bgcolor: chart.paper,
              font: chart.font, bargap: 0.45,
              xaxis: { ...axis(), showgrid: false, tickfont: { size: 11, color: "#6B7280" } },
              yaxis: { ...axis(), tickformat: ",.2s", ticksuffix: "", rangemode: "tozero" },
              hoverlabel: chart.hover, showlegend: false }}
            config={{ displayModeBar: false, responsive: true }} style={{ width: "100%" }} useResizeHandler
          />
          <p className="caption-quiet px-1 pb-1">Switching the basis adds the upstream share — production, transport and bunkering — that tank-to-wake reporting leaves out.</p>
        </Panel>

        <Panel title="Fleet compliance" actions={<Link to="/compliance" className="text-xs font-medium text-signal">Details</Link>} bodyClassName="px-5 pb-5">
          <FleetGauge vessels={vessels.map((v) => ({ id: v.id, rating: v.rating as CIIRating }))} compliantPct={compliantPct} />
          <div className="flex justify-center gap-3 -mt-1 mb-4">
            {(["A", "B", "C", "D", "E"] as CIIRating[]).map((g) => (
              <span key={g} className="flex items-center gap-1 text-2xs text-txt-tertiary">
                <span className="w-2 h-2 rounded-sm" style={{ background: CII_COLORS[g] }} aria-hidden="true" />{g}
                <span className="text-txt-quiet">{data.cii_distribution[g] ?? 0}</span>
              </span>
            ))}
          </div>
          {tightest && (
            <div className="border-t border-ink-line pt-4">
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-txt-tertiary">Tightest margin</span>
                <span className="text-txt-quiet">Target <span className="text-txt-primary font-medium">C boundary</span></span>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-medium text-txt-primary">{tightest.name}</span>
                <span className="metric metric-sm">{pct(tightest.margin_pct, 1)} headroom</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
                <div className="h-full rounded-full bg-signal" style={{ width: `${Math.min(100, Math.max(4, tightest.margin_pct * 4))}%` }} />
              </div>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Fleet position" subtitle="Vessels coloured by carbon intensity rating, ports by shore power availability" bodyClassName="p-0">
        <FleetMap routes={routes} ports={ports} vessels={vessels} height="400px" />
      </Panel>

      <Panel title="Vessels" bodyClassName="p-0"
        actions={<>
          <label className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-[9px] border border-ink-line text-txt-quiet text-xs w-44">
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" {...s}><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3 3"/></svg>
            <input className="flex-1 bg-transparent outline-none text-txt-primary placeholder:text-txt-quiet" placeholder="Search" />
          </label>
          <Link to="/fleet" className="btn btn-ghost text-xs h-8 py-0">Open register</Link>
        </>}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>
              <th>Vessel</th><th className="hidden md:table-cell">Type</th><th className="text-right hidden sm:table-cell">Deadweight</th>
              <th className="hidden lg:table-cell">Fuel</th><th className="text-right">Intensity</th><th className="w-56">Rating</th><th className="text-right hidden xl:table-cell">Margin</th>
            </tr></thead>
            <tbody>
              {vessels.map((v) => (
                <tr key={v.id}>
                  <td><Link to={`/fleet?vessel=${v.id}`} className="font-medium text-txt-primary hover:text-signal">{v.name}</Link></td>
                  <td className="hidden md:table-cell">{SHIP_TYPE_LABELS[v.ship_type] ?? v.ship_type}</td>
                  <td className="text-right metric metric-xs hidden sm:table-cell">{int(v.dwt)}</td>
                  <td className="hidden lg:table-cell">{v.current_fuel}</td>
                  <td className="text-right metric metric-xs">{num(v.attained_cii, 2)}</td>
                  <td><div className="flex items-center gap-2.5"><CIIBadge rating={v.rating as CIIRating} size="sm" />
                    <div className="flex-1 min-w-[100px]"><CIIRail attained={v.attained_cii} required={v.required_cii} boundaries={ratingBoundaries(v.required_cii)} rating={v.rating as CIIRating} size="sm" showScale={false} /></div></div></td>
                  <td className="text-right hidden xl:table-cell"><span className={`pill ${v.margin_pct < 5 ? "pill-warn" : "pill-good"}`}>{pct(v.margin_pct)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
export default DashboardPage;
