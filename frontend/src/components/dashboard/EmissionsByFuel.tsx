import type { DashboardSummary } from "../../types";
import { int, pct } from "../../utils/formatters";

type Row = DashboardSummary["emissions_by_fuel"][number];

/**
 * Lifecycle GHG per fuel in use across the fleet, split into what leaves the
 * funnel and what was emitted before the fuel reached the tank. The upstream
 * share is the part tank-to-wake reporting never shows.
 */
export function EmissionsByFuel({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => b.ghg_wtw_t - a.ghg_wtw_t);
  const max = Math.max(...sorted.map((r) => r.ghg_wtw_t), 1);
  const total = sorted.reduce((s, r) => s + r.ghg_wtw_t, 0);

  return (
    <div className="space-y-4">
      {sorted.map((r) => {
        const upstream = r.ghg_wtt_t / Math.max(r.ghg_wtw_t, 1e-9);
        return (
          <div key={r.fuel_id}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="flex items-center gap-2 text-sm text-txt-primary min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} aria-hidden="true" />
                <span className="truncate">{r.fuel_name}</span>
              </span>
              <span className="metric metric-xs shrink-0">
                {int(r.ghg_wtw_t)} <span className="unit text-2xs">t CO₂e</span>
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-ink-800" title={`${int(r.ghg_ttw_t)} t at the funnel, ${int(r.ghg_wtt_t)} t upstream`}>
              <span className="h-full" style={{ width: `${(r.ghg_ttw_t / max) * 100}%`, background: r.color }} />
              <span className="h-full" style={{ width: `${(r.ghg_wtt_t / max) * 100}%`, background: r.color, opacity: 0.35 }} />
            </div>
            <p className="caption-quiet mt-1">
              {int(r.fuel_tonnes)} t burned · {pct(upstream * 100, 0)} of its footprint is upstream · {pct((r.ghg_wtw_t / Math.max(total, 1e-9)) * 100, 0)} of fleet total
            </p>
          </div>
        );
      })}
      <p className="caption flex items-center gap-4 pt-3 border-t border-ink-line">
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-txt-secondary" aria-hidden="true" />At the funnel</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-txt-secondary opacity-35" aria-hidden="true" />Upstream, well-to-tank</span>
      </p>
    </div>
  );
}
export default EmissionsByFuel;
