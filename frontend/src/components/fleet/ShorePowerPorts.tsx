import type { ShorePowerResult } from "../../types";
import { num, usd } from "../../utils/formatters";

/**
 * One vessel's shore-power decision at every port it might call at. The
 * grid's carbon intensity is shown because it is the number that flips the
 * recommendation: plugging into a coal-heavy grid emits more than the
 * auxiliary engine would.
 */
export function ShorePowerPorts({ ports, capable }: { ports: ShorePowerResult[]; capable: boolean }) {
  const sorted = [...ports].sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.ghg_saving_wtw_t - a.ghg_saving_wtw_t);
  const recommended = sorted.filter((p) => p.recommended);
  const saving = recommended.reduce((s, p) => s + p.ghg_saving_wtw_t, 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-4">
        <span className="metric metric-lg">{recommended.length}</span>
        <span className="text-xs unit">of {ports.length} ports worth connecting at</span>
        {saving > 0 && <span className="pill pill-good ml-1">{num(saving, 1)} t CO₂e per round of calls</span>}
        {!capable && <span className="pill pill-neutral ml-1">No shore connection fitted</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Port</th>
              <th className="text-right">Grid intensity</th>
              <th className="text-right hidden sm:table-cell">Engine option</th>
              <th className="text-right hidden sm:table-cell">Shore option</th>
              <th className="text-right">Saving</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.port_id}>
                <td className="font-medium text-txt-primary whitespace-nowrap">{p.port_name}</td>
                <td className="text-right metric metric-xs">{num(p.shore_power_option.grid_ci_gco2_per_kwh, 0)} <span className="unit text-2xs">g/kWh</span></td>
                <td className="text-right metric metric-xs hidden sm:table-cell">{num(p.auxiliary_option.ghg_wtw_t, 1)} t</td>
                <td className="text-right metric metric-xs hidden sm:table-cell">{p.feasible ? `${num(p.shore_power_option.ghg_wtw_t, 1)} t` : "—"}</td>
                <td className={`text-right metric metric-xs ${p.recommended ? "text-good" : ""}`}>
                  {p.feasible ? `${p.ghg_saving_wtw_t >= 0 ? "" : "+"}${num(Math.abs(p.ghg_saving_wtw_t), 1)} t` : "—"}
                  {p.recommended && <span className="block text-2xs text-txt-quiet font-normal">{usd(p.cost_saving_usd, true)}</span>}
                </td>
                <td>
                  <span className={`pill ${p.recommended ? "pill-good" : p.feasible ? "pill-warn" : "pill-neutral"}`} title={p.rationale}>
                    {p.recommended ? "Connect" : p.feasible ? "Decline" : (p.blockers[0] ?? "Not possible")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default ShorePowerPorts;
