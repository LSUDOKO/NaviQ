/** Shared Plotly styling so every chart reads as one system on the light canvas. */
export const chart = {
  font: { color: "#6B7280", size: 11, family: "Inter, system-ui, sans-serif" },
  grid: "#EEF0F4",
  zero: "#E3E6EC",
  accent: "#2563EB",
  accentSoft: "#BFD3FF",
  accentFill: "rgba(37,99,235,0.12)",
  muted: "#CBD2DC",
  mutedDark: "#9CA3AF",
  amber: "#D97706",
  sky: "#0EA5E9",
  green: "#16A34A",
  red: "#DC2626",
  violet: "#7C3AED",
  hover: { bgcolor: "#111827", bordercolor: "#111827", font: { size: 11, color: "#FFFFFF", family: "Inter, system-ui, sans-serif" } },
  paper: "rgba(0,0,0,0)",
  series: ["#2563EB", "#0EA5E9", "#D97706", "#7C3AED", "#65A30D"],
};

export function axis(extra: Record<string, unknown> = {}) {
  return { gridcolor: chart.grid, zerolinecolor: chart.zero, linecolor: chart.grid, tickfont: { size: 11, color: "#6B7280" }, ...extra };
}
