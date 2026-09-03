import { Link } from "react-router-dom";
import { CIIBadge, CIIRail } from "../components/common/CIIRail";
import FleetMap from "../components/common/FleetMap";
import LoadingSpinner, { ErrorState } from "../components/common/LoadingSpinner";
import MetricCard from "../components/common/MetricCard";
import Panel from "../components/common/Panel";
import { useAsync } from "../hooks/usePrediction";
import api from "../services/api";
import type { CIIRating } from "../types";
import { CII_COLORS, CII_ORDER, SHIP_TYPE_LABELS } from "../utils/constants";
import { int, num, pct, tonnes, usd } from "../utils/formatters";
import { ratingBoundaries } from "../utils/cii";

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() => api.dashboardSummary(2026), []);

  if (loading) return <LoadingSpinner label="Reading fleet data" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { kpis, cii_distribution, vessels, emissions_by_fuel, routes, ports } = data;
  const totalWtW = emissions_by_fuel.reduce((sum, f) => sum + f.ghg_wtw_t, 0);
  const maxFuelBar = Math.max(...emissions_by_fuel.map((f) => f.ghg_wtw_t), 1);

  return (
    <div className="space-y-5">
      {/* The figures come first. This is a console, not a landing page. */}
      <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Annual fuel burn"
          value={int(kpis.annual_fuel_tonnes)}
          unit="tonnes"
          hint={`${usd(kpis.annual_fuel_cost_usd, true)} at current bunker prices`}
        />
        <MetricCard
          label="Well-to-Wake emissions"
          value={int(kpis.annual_ghg_wtw_tonnes)}
          unit="t CO₂e"
          accent="amber"
          hint={`${pct(kpis.wtt_share_pct)} of it upstream, before a drop is burned`}
        />
        <MetricCard
          label="Compliant vessels"
          value={`${kpis.compliant_vessels}/${kpis.fleet_size}`}
          accent={kpis.at_risk_vessels > 0 ? "amber" : "teal"}
          hint={
            kpis.at_risk_vessels > 0
              ? `${kpis.at_risk_vessels} rated D or E`
              : "All rated C or better"
          }
        />
        <MetricCard
          label="Savings identified"
          value={kpis.realised_cost_saving_usd > 0 ? usd(kpis.realised_cost_saving_usd, true) : "—"}
          accent="teal"
          hint={
            kpis.optimizations_run > 0
              ? `${tonnes(kpis.realised_ghg_saving_t)} CO₂e across ${kpis.optimizations_run} run${kpis.optimizations_run === 1 ? "" : "s"}`
              : "Run an optimisation to populate"
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Fleet position"
          subtitle="Vessels coloured by carbon intensity rating, ports by shore power availability"
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <FleetMap routes={routes} ports={ports} vessels={vessels} height="440px" />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 border-t border-navy-700/70">
            <div className="flex items-center gap-2">
              <span className="text-2xs text-slate-500">Rating</span>
              {CII_ORDER.map((grade) => (
                <span key={grade} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CII_COLORS[grade] }}
                    aria-hidden="true"
                  />
                  <span className="text-2xs text-slate-400 font-mono">{grade}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xs text-slate-500">Shore power</span>
              {[
                ["Available", "#22C55E"],
                ["Planned", "#F59E0B"],
                ["None", "#64748B"],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-2xs text-slate-400">{label}</span>
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel
            title="Carbon intensity spread"
            subtitle={`Against the ${data.year} required line, Z = ${num(data.reduction_factor_z_pct, 0)}%`}
          >
            <div className="space-y-2.5">
              {CII_ORDER.map((grade) => {
                const count = cii_distribution[grade] ?? 0;
                const share = kpis.fleet_size > 0 ? (count / kpis.fleet_size) * 100 : 0;
                return (
                  <div key={grade} className="flex items-center gap-3">
                    <CIIBadge rating={grade} size="sm" />
                    <div className="flex-1 h-2 bg-navy-800 rounded-sm overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${share}%`, backgroundColor: CII_COLORS[grade] }}
                      />
                    </div>
                    <span className="metric text-xs w-6 text-right text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-2xs text-slate-500 mt-4 leading-relaxed">
              A vessel rated D for three consecutive years, or E once, must file a corrective
              action plan under SEEMP Part III.
            </p>
          </Panel>

          <Panel
            title="Emissions by fuel"
            subtitle="Split into upstream production and combustion"
          >
            <div className="space-y-3">
              {emissions_by_fuel.map((fuel) => {
                const wttShare = (fuel.ghg_wtt_t / Math.max(fuel.ghg_wtw_t, 1e-9)) * 100;
                return (
                  <div key={fuel.fuel_id}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-xs text-slate-300">{fuel.fuel_name}</span>
                      <span className="metric text-xs text-slate-400">
                        {int(fuel.ghg_wtw_t)} <span className="unit">t</span>
                      </span>
                    </div>
                    <div
                      className="h-2.5 bg-navy-800 rounded-sm overflow-hidden flex"
                      style={{ width: `${(fuel.ghg_wtw_t / maxFuelBar) * 100}%`, minWidth: "12%" }}
                      title={`Well-to-Tank ${int(fuel.ghg_wtt_t)} t, Tank-to-Wake ${int(fuel.ghg_ttw_t)} t`}
                    >
                      <div
                        style={{ width: `${wttShare}%`, backgroundColor: fuel.color, opacity: 0.45 }}
                      />
                      <div style={{ width: `${100 - wttShare}%`, backgroundColor: fuel.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-2xs text-slate-500 mt-4 leading-relaxed">
              The pale segment is Well-to-Tank: emissions from producing and delivering the fuel,
              which tank-to-wake reporting leaves out entirely. It accounts for{" "}
              {pct((totalWtW - kpis.annual_co2_tonnes) / Math.max(totalWtW, 1e-9) * 100, 0)} of this
              fleet&rsquo;s footprint.
            </p>
          </Panel>
        </div>
      </div>

      <Panel
        title="Vessels"
        subtitle="Attained carbon intensity against the A to E boundaries"
        actions={
          <Link to="/fleet" className="text-xs text-teal hover:text-teal-bright">
            Open register
          </Link>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-2xs text-slate-500 border-b border-navy-700/70">
                <th className="text-left font-medium px-4 py-2.5">Vessel</th>
                <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Type</th>
                <th className="text-right font-medium px-4 py-2.5 hidden sm:table-cell">DWT</th>
                <th className="text-left font-medium px-4 py-2.5 hidden lg:table-cell">Fuel</th>
                <th className="text-right font-medium px-4 py-2.5">AER</th>
                <th className="text-left font-medium px-4 py-2.5 w-48">Rating</th>
                <th className="text-right font-medium px-4 py-2.5 hidden xl:table-cell">Margin</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => (
                <tr
                  key={vessel.id}
                  className="border-b border-navy-800/70 last:border-0 hover:bg-navy-850/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/fleet?vessel=${vessel.id}`}
                      className="text-slate-200 hover:text-teal transition-colors"
                    >
                      {vessel.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                    {SHIP_TYPE_LABELS[vessel.ship_type] ?? vessel.ship_type}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-slate-400 hidden sm:table-cell">
                    {int(vessel.dwt)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {vessel.current_fuel}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-slate-200">
                    {num(vessel.attained_cii, 2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CIIBadge rating={vessel.rating as CIIRating} size="sm" />
                      <div className="flex-1 min-w-[90px]">
                        <CIIRail
                          attained={vessel.attained_cii}
                          required={vessel.required_cii}
                          boundaries={ratingBoundaries(vessel.required_cii)}
                          rating={vessel.rating as CIIRating}
                          size="sm"
                          showScale={false}
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 text-right metric text-xs hidden xl:table-cell ${
                      vessel.margin_pct < 5 ? "text-amber" : "text-slate-500"
                    }`}
                  >
                    {pct(vessel.margin_pct)}
                  </td>
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
