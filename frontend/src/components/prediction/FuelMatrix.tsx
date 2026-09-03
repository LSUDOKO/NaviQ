import type { FuelComparison } from "../../types";
import { FUEL_COLORS, FUEL_SHORT } from "../../utils/constants";
import { int, num, signedPct, usd } from "../../utils/formatters";

/**
 * Every candidate fuel for the same voyage, ranked by lifecycle emissions.
 *
 * Tank-to-Wake and Well-to-Wake are shown side by side deliberately. Grey
 * ammonia emits almost nothing at the funnel and more than heavy fuel oil
 * across its life; a table that showed only the first column would recommend
 * exactly the wrong fuel.
 */
export function FuelMatrix({ comparison }: { comparison: FuelComparison }) {
  const maxWtW = Math.max(...comparison.fuels.map((f) => f.ghg_wtw_t), 1);
  const flagged = comparison.fuels.filter((f) => f.greenwash_risk);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-2xs text-txt-tertiary border-b border-ink-700/70">
              <th className="text-left font-medium px-4 py-2.5">Fuel</th>
              <th className="text-right font-medium px-4 py-2.5">Mass</th>
              <th className="text-right font-medium px-4 py-2.5 hidden lg:table-cell">Volume</th>
              <th className="text-right font-medium px-4 py-2.5">Cost</th>
              <th className="text-right font-medium px-4 py-2.5">At the funnel</th>
              <th className="text-right font-medium px-4 py-2.5">Full lifecycle</th>
              <th className="text-left font-medium px-4 py-2.5 w-32">vs baseline</th>
            </tr>
          </thead>
          <tbody>
            {comparison.fuels.map((fuel) => {
              const isBaseline = fuel.fuel_id === comparison.baseline_fuel;
              const incompatible = fuel.vessel_compatible === false;
              return (
                <tr
                  key={fuel.fuel_id}
                  className={`border-b border-ink-800/70 last:border-0 transition-colors hover:bg-ink-850/40 ${
                    incompatible ? "opacity-45" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: FUEL_COLORS[fuel.fuel_id] ?? "#64748B" }}
                        aria-hidden="true"
                      />
                      <span className="text-txt-primary">
                        {FUEL_SHORT[fuel.fuel_id] ?? fuel.fuel_name}
                      </span>
                      {isBaseline && (
                        <span className="chip bg-ink-800 text-txt-tertiary border border-ink-bright">
                          current
                        </span>
                      )}
                      {fuel.greenwash_risk && (
                        <span
                          className="chip bg-cii-e/12 text-cii-e border border-cii-e/30"
                          title="Low emissions at the funnel, higher across the full lifecycle"
                        >
                          misleading
                        </span>
                      )}
                      {incompatible && (
                        <span className="chip bg-ink-800 text-txt-quiet border border-ink-700">
                          needs retrofit
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-txt-secondary">
                    {num(fuel.fuel_mass_t, 1)}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-txt-tertiary hidden lg:table-cell">
                    {int(fuel.fuel_volume_m3)} m³
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-txt-secondary">
                    {usd(fuel.fuel_cost_usd, true)}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-txt-secondary">
                    {num(fuel.ghg_ttw_t, 1)}
                  </td>
                  <td className="px-4 py-3 text-right metric text-xs text-txt-primary">
                    {num(fuel.ghg_wtw_t, 1)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-ink-800 rounded-sm overflow-hidden min-w-[44px]">
                        <div
                          className="h-full"
                          style={{
                            width: `${(fuel.ghg_wtw_t / maxWtW) * 100}%`,
                            backgroundColor: FUEL_COLORS[fuel.fuel_id] ?? "#64748B",
                          }}
                        />
                      </div>
                      <span
                        className={`metric text-2xs w-14 text-right ${
                          fuel.delta_vs_baseline.ghg_wtw_pct < 0 ? "text-cii-a" : "text-cii-e"
                        }`}
                      >
                        {signedPct(fuel.delta_vs_baseline.ghg_wtw_pct, 0)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-ink-700/70 space-y-2">
        <p className="text-2xs text-txt-tertiary leading-relaxed">
          Mass and volume differ far more than energy does. Ammonia carries less than half the
          energy per tonne of heavy fuel oil, so the same voyage needs roughly twice the bunker
          weight and three times the tank space — often the binding constraint, not the price.
        </p>
        {flagged.length > 0 && (
          <p className="text-2xs text-cii-e leading-relaxed">
            {flagged.map((f) => FUEL_SHORT[f.fuel_id] ?? f.fuel_name).join(" and ")}{" "}
            {flagged.length === 1 ? "looks" : "look"} clean at the funnel but{" "}
            {flagged.length === 1 ? "emits" : "emit"} more than the baseline once production is
            counted. Tank-to-Wake reporting alone would recommend{" "}
            {flagged.length === 1 ? "it" : "them"}.
          </p>
        )}
      </div>
    </div>
  );
}

export default FuelMatrix;
