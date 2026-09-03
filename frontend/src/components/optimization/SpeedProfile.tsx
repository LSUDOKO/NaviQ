import { chart } from "../../utils/chartTheme";
import Plot from "react-plotly.js";
import type { SpeedProfileLeg } from "../../types";

/**
 * Speed and sea state along a voyage.
 *
 * The two series together explain the plan: where the optimiser slowed down,
 * and whether it did so because of weather or because of the arrival window.
 */
export function SpeedProfile({ legs }: { legs: SpeedProfileLeg[] }) {
  // Cumulative distance makes the x-axis physical, so a long ocean leg reads as
  // long rather than occupying the same width as a short coastal hop.
  const cumulative: number[] = [];
  let running = 0;
  for (const leg of legs) {
    running += leg.distance_nm;
    cumulative.push(running);
  }

  const axis = { gridcolor: chart.grid, zerolinecolor: chart.zero, tickfont: { size: 10 } };

  return (
    <Plot
      data={[
        {
          x: cumulative,
          y: legs.map((leg) => leg.weather?.wave_height_m ?? 0),
          type: "scatter",
          mode: "lines",
          name: "Wave height",
          fill: "tozeroy",
          fillcolor: "rgba(14,165,233,0.14)",
          line: { color: chart.sky, width: 1, shape: "hv" },
          yaxis: "y2",
          hovertemplate: "%{y:.1f} m<extra>Sea state</extra>",
        },
        {
          x: cumulative,
          y: legs.map((leg) => leg.speed_kn),
          type: "scatter",
          mode: "lines+markers",
          name: "Speed",
          line: { color: chart.accent, width: 2.5, shape: "hv" },
          marker: { size: 5, color: chart.accent },
          text: legs.map(
            (leg) =>
              `${leg.from} → ${leg.to}<br>${leg.speed_kn.toFixed(1)} kn · ${(leg.shaft_power_kw / 1000).toFixed(1)} MW<br>Engine at ${leg.engine_load_pct.toFixed(0)}% MCR`,
          ),
          hovertemplate: "%{text}<extra></extra>",
        },
      ]}
      layout={{
        autosize: true,
        height: 250,
        margin: { l: 52, r: 48, t: 10, b: 42 },
        paper_bgcolor: chart.paper,
        plot_bgcolor: chart.paper,
        font: { color: "#6B7280", size: 11, family: "Inter, sans-serif" },
        xaxis: { ...axis, title: { text: "Distance along route (nm)", font: { size: 11 } } },
        yaxis: { ...axis, title: { text: "Speed (kn)", font: { size: 11 } }, color: chart.accent },
        yaxis2: {
          ...axis,
          title: { text: "Wave (m)", font: { size: 11 } },
          overlaying: "y",
          side: "right",
          color: chart.sky,
          rangemode: "tozero",
        },
        legend: { orientation: "h", y: -0.26, font: { size: 10 } },
        hoverlabel: { ...chart.hover, align: "left" },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}

export default SpeedProfile;
