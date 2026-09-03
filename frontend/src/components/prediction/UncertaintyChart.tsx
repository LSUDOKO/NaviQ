import { chart } from "../../utils/chartTheme";
import Plot from "react-plotly.js";
import type { PredictionLeg, WeatherLeg } from "../../types";

interface UncertaintyChartProps {
  legs: PredictionLeg[];
  weather: WeatherLeg[];
}

/**
 * Fuel rate per leg with its confidence band.
 *
 * The band is the point: a single line implies a precision the model does not
 * have, and the width tells an operator which legs of the passage are the ones
 * that could surprise them.
 */
export function UncertaintyChart({ legs, weather }: UncertaintyChartProps) {
  const x = legs.map((_, index) => index + 1);
  const mean = legs.map((leg) => leg.fuel_rate_kg_per_h);
  const sigma = legs.map((leg) => leg.fuel_rate_std_kg_per_h ?? 0);

  const upper = mean.map((value, index) => value + 1.96 * sigma[index]);
  const lower = mean.map((value, index) => Math.max(0, value - 1.96 * sigma[index]));
  const hasBand = sigma.some((value) => value > 0);

  const hover = legs.map((leg, index) => {
    const conditions = weather[index];
    return [
      `Leg ${index + 1}`,
      `${leg.fuel_rate_kg_per_h.toFixed(0)} kg/h at ${leg.speed_kn.toFixed(1)} kn`,
      conditions ? `${conditions.sea_state} sea, ${conditions.wave_height_m.toFixed(1)} m` : "",
      conditions ? `Wind ${conditions.wind_speed_kn.toFixed(0)} kn` : "",
    ]
      .filter(Boolean)
      .join("<br>");
  });

  return (
    <Plot
      data={[
        ...(hasBand
          ? [
              {
                x: [...x, ...[...x].reverse()],
                y: [...upper, ...[...lower].reverse()],
                fill: "toself" as const,
                fillcolor: chart.accentFill,
                line: { color: chart.paper },
                hoverinfo: "skip" as const,
                showlegend: true,
                name: "95% interval",
                type: "scatter" as const,
              },
            ]
          : []),
        {
          x,
          y: mean,
          type: "scatter" as const,
          mode: "lines+markers" as const,
          line: { color: chart.accent, width: 2.5, shape: "spline" as const },
          marker: { size: 6, color: chart.accent },
          name: "Predicted rate",
          text: hover,
          hovertemplate: "%{text}<extra></extra>",
        },
      ]}
      layout={{
        autosize: true,
        height: 260,
        margin: { l: 56, r: 14, t: 10, b: 40 },
        paper_bgcolor: chart.paper,
        plot_bgcolor: chart.paper,
        font: { color: "#6B7280", size: 11, family: "Inter, sans-serif" },
        xaxis: {
          title: { text: "Voyage leg", font: { size: 11 } },
          gridcolor: chart.grid,
          zerolinecolor: chart.zero,
          dtick: 1,
        },
        yaxis: {
          title: { text: "Fuel rate (kg/h)", font: { size: 11 } },
          gridcolor: chart.grid,
          zerolinecolor: chart.zero,
        },
        legend: { orientation: "h", y: -0.24, font: { size: 10 } },
        hoverlabel: chart.hover,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}

export default UncertaintyChart;
