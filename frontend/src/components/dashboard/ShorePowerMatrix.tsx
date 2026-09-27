import type { Port, ShorePowerResult } from "../../types";
import { num, usd } from "../../utils/formatters";

export interface ShorePowerMatrixData {
  berth_hours: number;
  vessels: Array<{
    vessel_id: string;
    vessel_name: string;
    shore_power_capable: boolean;
    ports: ShorePowerResult[];
    n_feasible: number;
    n_recommended: number;
    total_ghg_saving_t: number;
  }>;
  ports: Port[];
  fleet_ghg_saving_t: number;
}

/**
 * Every vessel at every port: should it plug in? Green means the optimiser
 * would connect, amber means it can but the grid is dirtier than the
 * auxiliary engine, grey means the connection is not possible at all.
 */
export function ShorePowerMatrix({ data }: { data: ShorePowerMatrixData }) {
  const cell = (r: ShorePowerResult) =>
    r.recommended ? { cls: "bg-good", label: "connect" }
      : r.feasible ? { cls: "bg-warn", label: "decline" }
      : { cls: "bg-ink-bright", label: "blocked" };

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="metric metric-lg">{num(data.fleet_ghg_saving_t, 1)}</span>
        <span className="text-xs unit">t CO₂e saved per {num(data.berth_hours, 0)} h port call, fleet-wide</span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs border-separate border-spacing-y-1 table-fixed">
          <thead>
            <tr>
              <th className="text-left font-medium text-txt-tertiary pb-1 pr-1 w-[108px]">Vessel</th>
              {data.ports.map((p) => (
                <th key={p.id} className="font-medium text-txt-quiet text-[10px] pb-1 px-0 text-center" title={`${p.name} · grid ${p.grid_ci_gco2_per_kwh} gCO₂/kWh`}>
                  {p.id.slice(-3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.vessels.map((v) => (
              <tr key={v.vessel_id}>
                <td className="pr-1 text-txt-primary truncate" title={v.shore_power_capable ? v.vessel_name : `${v.vessel_name} has no shore connection`}>
                  {v.vessel_name.replace(/^MV /, "")}
                  {!v.shore_power_capable && <span className="ml-1 text-txt-quiet text-2xs">no plug</span>}
                </td>
                {v.ports.map((r) => {
                  const c = cell(r);
                  return (
                    <td key={r.port_id} className="px-0 text-center">
                      <span
                        className={`inline-block w-[18px] h-[18px] rounded-[5px] ${c.cls}`}
                        title={`${r.port_name}: ${c.label}. ${r.rationale}${r.recommended ? ` Saves ${usd(r.cost_saving_usd, true)} and ${num(r.ghg_saving_wtw_t, 1)} t.` : ""}`}
                        aria-label={`${v.vessel_name} at ${r.port_name}: ${c.label}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="caption flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-ink-line">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-good" aria-hidden="true" />Connect</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-warn" aria-hidden="true" />Decline, grid dirtier than the engine</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-ink-bright" aria-hidden="true" />Not possible</span>
      </p>
    </div>
  );
}
export default ShorePowerMatrix;
