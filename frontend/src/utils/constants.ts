import type { CIIRating } from "../types";

export const CII_COLORS: Record<CIIRating, string> = {
  A: "#22C55E",
  B: "#84CC16",
  C: "#F59E0B",
  D: "#F97316",
  E: "#EF4444",
};

export const CII_ORDER: CIIRating[] = ["A", "B", "C", "D", "E"];

/** Fuel swatch colours, mirrored from the backend fuel database. */
export const FUEL_COLORS: Record<string, string> = {
  HFO: "#78716C",
  VLSFO: "#A8A29E",
  MGO: "#D6D3D1",
  LNG: "#38BDF8",
  MEOH_GREY: "#FBBF24",
  MEOH_GREEN: "#F59E0B",
  NH3_GREY: "#C084FC",
  NH3_GREEN: "#A855F7",
  H2_GREEN: "#22D3EE",
};

export const FUEL_SHORT: Record<string, string> = {
  HFO: "HFO",
  VLSFO: "VLSFO",
  MGO: "MGO",
  LNG: "LNG",
  MEOH_GREY: "MeOH grey",
  MEOH_GREEN: "MeOH green",
  NH3_GREY: "NH₃ grey",
  NH3_GREEN: "NH₃ green",
  H2_GREEN: "H₂ green",
};

export const SHIP_TYPE_LABELS: Record<string, string> = {
  bulk_carrier: "Bulk Carrier",
  container_ship: "Container Ship",
  tanker: "Tanker",
  lng_carrier: "LNG Carrier",
  gas_carrier: "Gas Carrier",
  general_cargo: "General Cargo",
  refrigerated_cargo: "Reefer",
  ro_ro_cargo: "Ro-Ro Cargo",
};

export const OBJECTIVE_LABELS: Record<string, string> = {
  fuel_cost: "Fuel cost",
  ghg_wtw: "Well-to-Wake GHG",
  delay: "Schedule delay",
  compliance_risk: "Compliance risk",
  risk_adjusted_fuel: "Risk-adjusted fuel",
};

export const OBJECTIVE_HINTS: Record<string, string> = {
  fuel_cost: "Bunker spend across the deployment",
  ghg_wtw: "Lifecycle emissions including upstream production",
  delay: "Hours outside the contractual arrival window",
  compliance_risk: "Probability of breaching the CII limit",
  risk_adjusted_fuel: "Fuel penalised for weather volatility",
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Basemap tiles.
 *
 * OpenStreetMap rather than CARTO's dark theme: CARTO now stamps
 * "API KEY REQUIRED" across unauthenticated tiles rather than refusing them,
 * which looks like a broken map. OSM serves keyless tiles cleanly, and a CSS
 * filter (see `.leaflet-tile` in index.css) inverts them into the navy palette,
 * so the console aesthetic survives without a paid key.
 */
export const MAP_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export const SEA_STATE_COLORS: Record<string, string> = {
  Calm: "#22D3EE",
  Slight: "#38BDF8",
  Moderate: "#84CC16",
  Rough: "#F59E0B",
  "Very rough": "#F97316",
  High: "#EF4444",
};
