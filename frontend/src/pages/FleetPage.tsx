import { chart } from "../utils/chartTheme";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Plot from "react-plotly.js";
import { CIIBadge, CIIRail } from "../components/common/CIIRail";
import LoadingSpinner, { ErrorState } from "../components/common/LoadingSpinner";
import Panel from "../components/common/Panel";
import { useAsync } from "../hooks/usePrediction";
import api, { type VesselWithCII } from "../services/api";
import { FUEL_SHORT, SHIP_TYPE_LABELS } from "../utils/constants";
import { int, num, pct, power } from "../utils/formatters";

interface SpeedPowerPoint {
  speed_kn: number;
  shaft_power_kw: number;
  engine_load_pct: number;
  resistance_kn: number;
  fuel_per_1000nm_t: number;
}

export function FleetPage() {
  const [params, setParams] = useSearchParams();
  const fleet = useAsync(() => api.vesselsSummary(2026), []);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("vessel"));

  const detail = useAsync<{ speed_power_curve: SpeedPowerPoint[] } & VesselWithCII>(
    () => (selectedId ? api.vesselDetail(selectedId) : Promise.resolve(null as never)),
    [selectedId],
  );

  useEffect(() => {
    if (!selectedId && fleet.data?.length) setSelectedId(fleet.data[0].id);
  }, [fleet.data, selectedId]);

  useEffect(() => {
    if (selectedId) setParams({ vessel: selectedId }, { replace: true });
  }, [selectedId, setParams]);

  if (fleet.loading) return <LoadingSpinner label="Loading fleet register" />;
  if (fleet.error) return <ErrorState message={fleet.error} onRetry={fleet.reload} />;

  const vessels = fleet.data ?? [];
  const curve = detail.data?.speed_power_curve ?? [];
  const selected = vessels.find((v) => v.id === selectedId);

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <Panel title="Register" subtitle={`${vessels.length} vessels`} bodyClassName="p-0">
        <ul>
          {vessels.map((vessel) => (
            <li key={vessel.id}>
              <button
                type="button"
                onClick={() => setSelectedId(vessel.id)}
                className={`w-full text-left px-4 py-3 border-l-2 border-b border-b-navy-800/70 transition-colors ${
                  vessel.id === selectedId
                    ? "border-l-teal bg-ink-850"
                    : "border-l-transparent hover:bg-ink-850/50"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <CIIBadge rating={vessel.rating} size="sm" />
                  <span className="text-sm text-txt-primary truncate flex-1">{vessel.name}</span>
                </div>
                <p className="text-2xs text-txt-tertiary ml-7">
                  {SHIP_TYPE_LABELS[vessel.ship_type] ?? vessel.ship_type} ·{" "}
                  {int(vessel.dwt)} DWT · {vessel.built_year}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-5">
        {detail.loading && <Panel><LoadingSpinner label="Loading vessel" /></Panel>}

        {selected && detail.data && !detail.loading && (
          <>
            <Panel
              title={selected.name}
              subtitle={`IMO ${selected.imo} · ${selected.flag} flag · built ${selected.built_year}`}
              actions={<CIIBadge rating={selected.rating} />}
            >
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 mb-5">
                {[
                  { label: "Deadweight", value: int(selected.dwt), unit: "t" },
                  { label: "Length overall", value: num(selected.length_m, 1), unit: "m" },
                  { label: "Beam", value: num(selected.beam_m, 1), unit: "m" },
                  { label: "Design draft", value: num(selected.draft_design_m, 1), unit: "m" },
                  { label: "Main engine", value: power(selected.main_engine_kw), unit: "" },
                  { label: "Service speed", value: num(selected.speed_service_kn, 1), unit: "kn" },
                  { label: "Block coefficient", value: num(selected.block_coefficient, 3), unit: "" },
                  { label: "Annual distance", value: int(selected.annual_distance_nm), unit: "nm" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xs text-txt-tertiary mb-1">{stat.label}</p>
                    <p className="flex items-baseline gap-1">
                      <span className="metric text-base text-txt-primary">{stat.value}</span>
                      {stat.unit && <span className="text-2xs unit">{stat.unit}</span>}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-ink-700/70">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-txt-tertiary">Carbon intensity, 2026</span>
                  <span className="metric text-sm text-txt-primary">
                    {num(selected.attained_cii, 2)}{" "}
                    <span className="text-2xs unit">
                      against {num(selected.required_cii, 2)} required
                    </span>
                  </span>
                </div>
                <CIIRail
                  attained={selected.attained_cii}
                  required={selected.required_cii}
                  boundaries={selected.cii.boundaries}
                  rating={selected.rating}
                  size="lg"
                />
                <p className="text-2xs text-txt-tertiary mt-3 leading-relaxed">
                  {selected.cii.rating_description}. Headroom to the C boundary is{" "}
                  {pct(selected.cii.margin_to_c_boundary_pct)}.
                </p>
              </div>
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Speed against fuel"
                subtitle="Fuel burned per 1000 nm at each speed, in reference conditions"
              >
                {curve.length > 0 && (
                  <Plot
                    data={[
                      {
                        x: curve.map((p) => p.speed_kn),
                        y: curve.map((p) => p.fuel_per_1000nm_t),
                        type: "scatter",
                        mode: "lines",
                        name: "Fuel",
                        line: { color: chart.accent, width: 2.5, shape: "spline" },
                        fill: "tozeroy",
                        fillcolor: chart.accentFill,
                        hovertemplate: "%{x:.1f} kn: %{y:.1f} t per 1000 nm<extra></extra>",
                      },
                      {
                        x: [selected.speed_service_kn],
                        y: [
                          curve.reduce((closest, p) =>
                            Math.abs(p.speed_kn - selected.speed_service_kn) <
                            Math.abs(closest.speed_kn - selected.speed_service_kn)
                              ? p
                              : closest,
                          ).fuel_per_1000nm_t,
                        ],
                        type: "scatter",
                        mode: "markers",
                        name: "Service speed",
                        marker: { size: 11, color: chart.amber, symbol: "diamond" },
                        hovertemplate: "Service speed<extra></extra>",
                      },
                    ]}
                    layout={{
                      autosize: true,
                      height: 270,
                      margin: { l: 58, r: 16, t: 10, b: 42 },
                      paper_bgcolor: chart.paper,
                      plot_bgcolor: chart.paper,
                      font: { color: "#6B7280", size: 11, family: "Inter, sans-serif" },
                      xaxis: { title: { text: "Speed (kn)", font: { size: 11 } }, gridcolor: chart.grid },
                      yaxis: {
                        title: { text: "Tonnes per 1000 nm", font: { size: 11 } },
                        gridcolor: chart.grid,
                      },
                      showlegend: false,
                      hoverlabel: chart.hover,
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                )}
                <p className="text-2xs text-txt-quiet leading-relaxed mt-2">
                  The curve steepens because propulsive power rises with roughly the cube of speed
                  while distance stays fixed. This is the shape every speed decision on this ship
                  trades against.
                </p>
              </Panel>

              <Panel title="Fuel options" subtitle="What this engine can burn without a retrofit">
                <div className="space-y-2.5">
                  {selected.compatible_fuels.map((fuelId) => (
                    <div
                      key={fuelId}
                      className={`flex items-center justify-between px-3 py-2 rounded-sm border ${
                        fuelId === selected.current_fuel
                          ? "border-signal/40 bg-signal/[0.06]"
                          : "border-ink-700/60"
                      }`}
                    >
                      <span className="text-sm text-txt-primary">
                        {FUEL_SHORT[fuelId] ?? fuelId}
                      </span>
                      {fuelId === selected.current_fuel && (
                        <span className="chip bg-signal/12 text-signal border border-signal/30">
                          in use
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-ink-700/70 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-txt-tertiary">Shore power connection</span>
                    <span className={selected.shore_power_capable ? "text-cii-a" : "text-txt-tertiary"}>
                      {selected.shore_power_capable ? "Fitted" : "Not fitted"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-txt-tertiary">Propulsive efficiency</span>
                    <span className="metric text-txt-secondary">
                      {num(selected.propulsive_efficiency * 100, 1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-txt-tertiary">Auxiliary engines</span>
                    <span className="metric text-txt-secondary">{power(selected.aux_engine_kw)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-txt-tertiary">Speed range</span>
                    <span className="metric text-txt-secondary">
                      {num(selected.speed_min_kn, 0)} – {num(selected.speed_max_kn, 0)} kn
                    </span>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FleetPage;
