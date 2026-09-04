import axios from "axios";
import type {
  CIIRating,
  DashboardSummary,
  Formula,
  Fuel,
  FuelComparison,
  OptimizationResult,
  Port,
  PredictionResult,
  Route,
  SEEMPPlan,
  ShorePowerResult,
  Vessel,
} from "../types";

// In local dev, Vite proxies "/api" to the backend on :8000, so a relative
// base URL works with no configuration. In production (Cloudflare Pages),
// there is no proxy: VITE_API_URL must point at the deployed backend origin.
const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const client = axios.create({
  baseURL: `${API_ORIGIN}/api/v1`,
  timeout: 180_000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Surface the server's own message; a bare "Request failed" helps nobody.
    const detail = error?.response?.data?.detail;
    if (detail) {
      error.message = typeof detail === "string" ? detail : JSON.stringify(detail);
    } else if (error.code === "ECONNABORTED") {
      error.message = "The request timed out. The optimiser may still be running.";
    } else if (!error.response) {
      error.message = "Cannot reach the NAVIQ backend. Is it running on port 8000?";
    }
    return Promise.reject(error);
  },
);

export interface VesselWithCII extends Vessel {
  cii: import("../types").CIIResult;
  rating: CIIRating;
  attained_cii: number;
  required_cii: number;
}

export interface PredictionPayload {
  vessel_id: string;
  route_id?: string;
  waypoints?: Array<{ lat: number; lon: number; name?: string }>;
  fuel_id: string;
  speed_kn?: number;
  speeds_kn?: number[];
  weather?: Record<string, number>;
  month?: number;
  mc_samples?: number;
}

export interface OptimizePayload {
  vessel_ids: string[];
  route_ids: string[];
  fuel_ids?: string[];
  weights: Record<string, number>;
  n_solutions: number;
  year: number;
  month: number;
  uncertainty_lambda: number;
  qubo_steps: number;
  qubo_replicas: number;
  qpso_particles: number;
  qpso_iterations: number;
}

export const api = {
  // -- fleet ---------------------------------------------------------------
  listVessels: () => client.get<Vessel[]>("/vessels").then((r) => r.data),
  vesselsSummary: (year = 2026) =>
    client.get<VesselWithCII[]>("/vessels/summary", { params: { year } }).then((r) => r.data),
  getVessel: (id: string) => client.get<Vessel>(`/vessels/${id}`).then((r) => r.data),
  vesselDetail: (id: string, year = 2026) =>
    client.get(`/vessels/${id}/detail`, { params: { year } }).then((r) => r.data),
  createVessel: (payload: Partial<Vessel>) =>
    client.post<Vessel>("/vessels", payload).then((r) => r.data),
  updateVessel: (id: string, payload: Partial<Vessel>) =>
    client.put<Vessel>(`/vessels/${id}`, payload).then((r) => r.data),
  deleteVessel: (id: string) => client.delete(`/vessels/${id}`).then((r) => r.data),

  // -- routes and ports ----------------------------------------------------
  listRoutes: () => client.get<Route[]>("/routes").then((r) => r.data),
  getRoute: (id: string, month = 7) =>
    client.get<Route>(`/routes/${id}`, { params: { month } }).then((r) => r.data),
  routeForecast: (id: string, days = 7, month = 7) =>
    client.get(`/routes/${id}/forecast`, { params: { days, month } }).then((r) => r.data),
  listPorts: () => client.get<Port[]>("/ports").then((r) => r.data),

  // -- prediction ----------------------------------------------------------
  predict: (payload: PredictionPayload) =>
    client.post<PredictionResult>("/predict", payload).then((r) => r.data),
  compareFuels: (payload: PredictionPayload) =>
    client.post<FuelComparison>("/emissions/compare", payload).then((r) => r.data),
  listFuels: () => client.get<Fuel[]>("/fuels").then((r) => r.data),
  fuelProperties: () => client.get<Fuel[]>("/emissions/fuel-properties").then((r) => r.data),
  modelInfo: () => client.get("/model/info").then((r) => r.data),

  // -- optimisation --------------------------------------------------------
  startOptimization: (payload: OptimizePayload) =>
    client.post<{ task_id: string; websocket_url: string }>("/optimize", payload).then((r) => r.data),
  getOptimization: (taskId: string) =>
    client
      .get<{ status: string; progress: number; phase: string; error?: string; result?: OptimizationResult }>(
        `/optimize/${taskId}`,
      )
      .then((r) => r.data),
  listTasks: () => client.get("/optimize/tasks").then((r) => r.data),

  // -- compliance ----------------------------------------------------------
  fleetCII: (year = 2026) =>
    client
      .get<{
        year: number;
        reduction_factor_z_pct: number;
        vessels: Array<{
          vessel_id: string;
          vessel_name: string;
          ship_type: string;
          dwt: number;
          current_fuel: string;
          annual_distance_nm: number;
          annual_fuel_tonnes: number;
          cii: import("../types").CIIResult;
          seemp: SEEMPPlan;
        }>;
        rating_distribution: Record<CIIRating, number>;
        fleet_aer_gco2_per_tnm: number;
        fleet_co2_tonnes: number;
        n_compliant: number;
        n_non_compliant: number;
        at_risk_vessels: string[];
        rating_labels: Record<string, { label: string; description: string; color: string }>;
      }>("/compliance/cii", { params: { year } })
      .then((r) => r.data),
  ciiTrajectory: (startYear = 2023, endYear = 2032) =>
    client
      .get("/compliance/cii/trajectory", { params: { start_year: startYear, end_year: endYear } })
      .then((r) => r.data),
  ciiScenario: (payload: Record<string, unknown>) =>
    client.post("/compliance/scenario", payload).then((r) => r.data),
  ciiReference: () => client.get("/compliance/reference").then((r) => r.data),

  // -- emissions -----------------------------------------------------------
  wtwComparison: (energyMj = 350000, baseline = "HFO") =>
    client
      .get<FuelComparison>("/emissions/wtw", { params: { energy_mj: energyMj, baseline } })
      .then((r) => r.data),
  shorePowerMatrix: (berthHours = 30) =>
    client
      .get<{
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
      }>("/emissions/shore-power", { params: { berth_hours: berthHours } })
      .then((r) => r.data),

  // -- dashboard -----------------------------------------------------------
  dashboardSummary: (year = 2026) =>
    client.get<DashboardSummary>("/dashboard/summary", { params: { year } }).then((r) => r.data),
  mapData: (month = 7) =>
    client
      .get<{ month: number; routes: Route[]; ports: Port[] }>("/dashboard/map", { params: { month } })
      .then((r) => r.data),
  formulas: () => client.get<Record<string, Formula[]>>("/dashboard/formulas").then((r) => r.data),
  about: () => client.get("/about").then((r) => r.data),
};

export default api;
