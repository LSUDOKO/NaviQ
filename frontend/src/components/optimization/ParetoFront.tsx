import { chart } from "../../utils/chartTheme";
import Plot from "react-plotly.js";
import type { ParetoSolution } from "../../types";
import { CII_COLORS } from "../../utils/constants";
import { num, usd } from "../../utils/formatters";

interface ParetoFrontProps {
  solutions: ParetoSolution[];
  dominated: ParetoSolution[];
  selectedId: string | null;
  onSelect: (solutionId: string) => void;
}

/**
 * The Pareto front: cost against lifecycle emissions.
 *
 * Dominated solutions are drawn faintly behind the front so the shape of the
 * trade-off is visible -- an operator can see that the front really is a
 * frontier, not just the handful of points that happened to be returned.
 */
export function ParetoFront({ solutions, dominated, selectedId, onSelect }: ParetoFrontProps) {
  const worstRating = (solution: ParetoSolution) => {
    const order = ["A", "B", "C", "D", "E"];
    return solution.voyages.reduce((worst, voyage) => {
      const rating = voyage.cii?.rating ?? "C";
      return order.indexOf(rating) > order.indexOf(worst) ? rating : worst;
    }, "A");
  };

  const frontSorted = [...solutions].sort(
    (a, b) => a.totals.fuel_cost_usd - b.totals.fuel_cost_usd,
  );

  const hover = (solution: ParetoSolution) =>
    [
      `<b>${solution.solution_id} · ${solution.label}</b>`,
      `Cost ${usd(solution.totals.fuel_cost_usd)}`,
      `Lifecycle ${num(solution.totals.ghg_wtw_t, 0)} t CO₂e`,
      `Delay ${num(solution.totals.delay_hours, 1)} h`,
      `Worst rating ${worstRating(solution)}`,
      "<i>Click to inspect</i>",
    ].join("<br>");

  return (
    <Plot
      data={[
        ...(dominated.length
          ? [
              {
                x: dominated.map((s) => s.totals.fuel_cost_usd),
                y: dominated.map((s) => s.totals.ghg_wtw_t),
                type: "scatter" as const,
                mode: "markers" as const,
                name: "Dominated",
                marker: { size: 7, color: chart.muted, symbol: "circle-open", line: { width: 1.5 } },
                hovertemplate: "Dominated plan<br>%{x:$,.0f} · %{y:.0f} t<extra></extra>",
              },
            ]
          : []),
        {
          x: frontSorted.map((s) => s.totals.fuel_cost_usd),
          y: frontSorted.map((s) => s.totals.ghg_wtw_t),
          type: "scatter" as const,
          mode: "lines" as const,
          name: "Frontier",
          line: { color: chart.accent, width: 1.5, dash: "dot" },
          hoverinfo: "skip" as const,
        },
        {
          x: solutions.map((s) => s.totals.fuel_cost_usd),
          y: solutions.map((s) => s.totals.ghg_wtw_t),
          type: "scatter" as const,
          mode: "markers+text" as const,
          name: "Pareto-optimal",
          text: solutions.map((s) => s.solution_id),
          textposition: "top center" as const,
          textfont: { size: 9, color: chart.mutedDark },
          marker: {
            size: solutions.map((s) => (s.solution_id === selectedId ? 17 : 12)),
            color: solutions.map((s) => CII_COLORS[worstRating(s) as keyof typeof CII_COLORS]),
            line: {
              width: solutions.map((s) => (s.solution_id === selectedId ? 3 : 1.5)),
              color: solutions.map((s) => (s.solution_id === selectedId ? chart.accent : "#FFFFFF")),
            },
          },
          customdata: solutions.map((s) => s.solution_id),
          hovertext: solutions.map(hover),
          hovertemplate: "%{hovertext}<extra></extra>",
        },
      ]}
      layout={{
        autosize: true,
        height: 400,
        margin: { l: 68, r: 18, t: 14, b: 52 },
        paper_bgcolor: chart.paper,
        plot_bgcolor: chart.paper,
        font: { color: "#6B7280", size: 11, family: "Inter, sans-serif" },
        xaxis: {
          title: { text: "Fuel cost (USD)", font: { size: 11 } },
          gridcolor: chart.grid,
          zerolinecolor: chart.zero,
          // SI-suffixed ticks collapse distinct values onto the same label
          // ("$1M, $1M, $1M") once the front spans a narrow range at the top
          // end. Three significant figures keeps every tick distinguishable.
          tickformat: "$,.3s",
        },
        yaxis: {
          title: { text: "Well-to-Wake emissions (t CO₂e)", font: { size: 11 } },
          gridcolor: chart.grid,
          zerolinecolor: chart.zero,
        },
        legend: { orientation: "h", y: -0.19, font: { size: 10 } },
        hoverlabel: { ...chart.hover, align: "left" },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
      useResizeHandler
      onClick={(event) => {
        const point = event.points?.[0] as { customdata?: string } | undefined;
        if (point?.customdata) onSelect(point.customdata);
      }}
    />
  );
}

export default ParetoFront;
