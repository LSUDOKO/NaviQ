import { Link } from "react-router-dom";
import { CIIBadge, CIIRail } from "../components/common/CIIRail";
import FleetMap from "../components/common/FleetMap";
import LoadingSpinner, { ErrorState } from "../components/common/LoadingSpinner";
import Panel from "../components/common/Panel";
import { useAsync } from "../hooks/usePrediction";
import api from "../services/api";
import type { CIIRating } from "../types";
import { ratingBoundaries } from "../utils/cii";
import { CII_COLORS, CII_ORDER, SHIP_TYPE_LABELS } from "../utils/constants";
import { int, num, pct, tonnes, usd } from "../utils/formatters";

export function DashboardPage() {
  const { data, loading, error, reload } = useAsync(() => api.dashboardSummary(2026), []);

  if (loading) return <LoadingSpinner label="Reading fleet data" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { kpis, cii_distribution, vessels, emissions_by_fuel, routes, ports } = data;
  const upstream = kpis.annual_ghg_wtw_tonnes - kpis.annual_co2_tonnes;
  const maxFuelBar = Math.max(...emissions_by_fuel.map((f) => f.ghg_wtw_t), 1);
  const tightest = [...vessels].sort((a, b) => a.margin_pct - b.margin_pct)[0];

  return (
    <div className="space-y-4">
      {/*
        The hero is the fleet's lifecycle footprint, not a KPI grid.
        One figure carries the page, and the supporting numbers sit beside it at
        a lower rank rather than competing as four equal boxes.
      */}
      <section className="panel-raised">
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="p-6 lg:p-7">
            <p className="text-2xs text-txt-tertiary mb-3">
              Fleet emissions this year, measured across the full fuel lifecycle
            </p>
            <p className="flex items-baseline gap-2.5">
              <span className="metric metric-hero text-txt-primary">
                {int(kpis.annual_ghg_wtw_tonnes)}
              </span>
              <span className="text-base unit">t CO₂e</span>
            </p>

            {/* Combustion against upstream, as one bar. The split is the argument. */}
            <div className="mt-5 max-w-md">
              <div className="flex h-1.5 rounded-sm overflow-hidden">
                <div
                  className="bg-signal"
                  style={{ width: `${(kpis.annual_co2_tonnes / kpis.annual_ghg_wtw_tonnes) * 100}%` }}
                />
                <div
                  className="bg-warn"
                  style={{ width: `${(upstream / kpis.annual_ghg_wtw_tonnes) * 100}%` }}
                />
              </div>
              <div className="flex justify-between mt-2.5 text-2xs">
                <span className="flex items-center gap-1.5 text-txt-tertiary">
                  <span className="w-1.5 h-1.5 rounded-full bg-signal" aria-hidden="true" />
                  {int(kpis.annual_co2_tonnes)} t burned at sea
                </span>
                <span className="flex items-center gap-1.5 text-txt-tertiary">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn" aria-hidden="true" />
                  {int(upstream)} t before bunkering
                </span>
              </div>
            </div>

            <p className="caption mt-5 max-w-lg">
              {pct(kpis.wtt_share_pct, 0)} of this fleet&rsquo;s footprint is produced before a
              drop of fuel reaches a tank. Tank-to-wake reporting counts none of it.
            </p>
          </div>

          <div className="grid grid-cols-2 border-t lg:border-t-0 lg:border-l border-ink-line">
            {[
              {
                label: "Fuel burned",
                value: int(kpis.annual_fuel_tonnes),
                unit: "t",
                hint: `${usd(kpis.annual_fuel_cost_usd, true)} at current prices`,
              },
              {
                label: "Fleet",
                value: String(kpis.fleet_size),
                unit: "vessels",
                hint: `${int(kpis.total_dwt)} t deadweight`,
              },
              {
                label: "Within CII limits",
                value: `${kpis.compliant_vessels}/${kpis.fleet_size}`,
                hint:
                  kpis.at_risk_vessels > 0
                    ? `${kpis.at_risk_vessels} rated D or E`
                    : `Tightest margin ${pct(tightest?.margin_pct ?? 0, 1)}`,
                accent: kpis.at_risk_vessels > 0 ? "warn" : "signal",
              },
              {
                label: "Savings found",
                value:
                  kpis.realised_cost_saving_usd > 0 ? usd(kpis.realised_cost_saving_usd, true) : "—",
                hint:
                  kpis.optimizations_run > 0
                    ? `${tonnes(kpis.realised_ghg_saving_t, 0)} CO₂e avoided`
                    : "Run an optimisation",
                accent: "signal",
              },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className={`px-5 py-5 ${index % 2 === 0 ? "border-r" : ""} ${
                  index < 2 ? "border-b" : ""
                } border-ink-line`}
              >
                <p className="text-2xs text-txt-tertiary mb-2">{stat.label}</p>
                <p className="flex items-baseline gap-1.5">
                  <span
                    className={`metric metric-lg ${
                      stat.accent === "signal"
                        ? "text-signal"
                        : stat.accent === "warn"
                          ? "text-warn"
                          : "text-txt-primary"
                    }`}
                  >
                    {stat.value}
                  </span>
                  {stat.unit && <span className="text-2xs unit">{stat.unit}</span>}
                </p>
                <p className="caption-quiet mt-1.5">{stat.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Fleet position"
          subtitle="Vessels by carbon intensity rating, ports by shore power"
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <FleetMap routes={routes} ports={ports} vessels={vessels} height="430px" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-t border-ink-line">
            <div className="flex items-center gap-2">
              <span className="text-2xs text-txt-quiet">Rating</span>
              {CII_ORDER.map((grade) => (
                <span key={grade} className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: CII_COLORS[grade] }}
                    aria-hidden="true"
                  />
                  <span className="text-2xs text-txt-tertiary font-mono">{grade}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xs text-txt-quiet">Shore power</span>
              {[
                ["Available", "#22C55E"],
                ["Planned", "#F59E0B"],
                ["None", "#3E5169"],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="text-2xs text-txt-tertiary">{label}</span>
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Ratings"
            subtitle={`Against the ${data.year} required line, Z = ${num(data.reduction_factor_z_pct, 0)}%`}
          >
            <div className="space-y-2.5">
              {CII_ORDER.map((grade) => {
                const count = cii_distribution[grade] ?? 0;
                const share = kpis.fleet_size > 0 ? (count / kpis.fleet_size) * 100 : 0;
                return (
                  <div key={grade} className="flex items-center gap-3">
                    <CIIBadge rating={grade} size="sm" />
                    <div className="flex-1 h-1.5 bg-ink-800 rounded-sm overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${share}%`, backgroundColor: CII_COLORS[grade] }}
                      />
                    </div>
                    <span className="metric metric-xs w-4 text-right text-txt-tertiary">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="caption-quiet mt-4">
              Rated D three years running, or E once, and a corrective action plan becomes
              mandatory under SEEMP Part III.
            </p>
          </Panel>

          <Panel title="By fuel" subtitle="Upstream production against combustion">
            <div className="space-y-3.5">
              {emissions_by_fuel.map((fuel) => {
                const wttShare = (fuel.ghg_wtt_t / Math.max(fuel.ghg_wtw_t, 1e-9)) * 100;
                return (
                  <div key={fuel.fuel_id}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xs text-txt-secondary">{fuel.fuel_name}</span>
                      <span className="metric metric-xs text-txt-tertiary">
                        {int(fuel.ghg_wtw_t)} <span className="unit">t</span>
                      </span>
                    </div>
                    <div
                      className="h-2 bg-ink-800 rounded-sm overflow-hidden flex"
                      style={{ width: `${(fuel.ghg_wtw_t / maxFuelBar) * 100}%`, minWidth: "14%" }}
                      title={`Upstream ${int(fuel.ghg_wtt_t)} t · combustion ${int(fuel.ghg_ttw_t)} t`}
                    >
                      <div style={{ width: `${wttShare}%`, backgroundColor: fuel.color, opacity: 0.42 }} />
                      <div style={{ width: `${100 - wttShare}%`, backgroundColor: fuel.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Vessels"
        subtitle="Attained carbon intensity against the A to E boundaries"
        actions={
          <Link to="/fleet" className="text-2xs text-signal hover:text-signal-bright transition-colors">
            Open register
          </Link>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vessel</th>
                <th className="hidden md:table-cell">Type</th>
                <th className="text-right hidden sm:table-cell">Deadweight</th>
                <th className="hidden lg:table-cell">Fuel</th>
                <th className="text-right">Intensity</th>
                <th className="w-52">Rating</th>
                <th className="text-right hidden xl:table-cell">Margin</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => (
                <tr key={vessel.id}>
                  <td>
                    <Link
                      to={`/fleet?vessel=${vessel.id}`}
                      className="text-txt-primary hover:text-signal transition-colors"
                    >
                      {vessel.name}
                    </Link>
                  </td>
                  <td className="text-txt-tertiary text-2xs hidden md:table-cell">
                    {SHIP_TYPE_LABELS[vessel.ship_type] ?? vessel.ship_type}
                  </td>
                  <td className="text-right metric metric-xs text-txt-secondary hidden sm:table-cell">
                    {int(vessel.dwt)}
                  </td>
                  <td className="text-txt-secondary text-2xs hidden lg:table-cell">
                    {vessel.current_fuel}
                  </td>
                  <td className="text-right metric metric-xs text-txt-primary">
                    {num(vessel.attained_cii, 2)}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <CIIBadge rating={vessel.rating as CIIRating} size="sm" />
                      <div className="flex-1 min-w-[96px]">
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
                    className={`text-right metric metric-xs hidden xl:table-cell ${
                      vessel.margin_pct < 5 ? "text-warn" : "text-txt-quiet"
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
