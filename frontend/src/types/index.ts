export type CIIRating = "A" | "B" | "C" | "D" | "E";

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  flag: string;
  ship_type: string;
  dwt: number;
  gross_tonnage: number;
  length_m: number;
  beam_m: number;
  draft_design_m: number;
  block_coefficient: number;
  wetted_surface_m2: number;
  frontal_area_m2: number;
  speed_min_kn: number;
  speed_max_kn: number;
  speed_service_kn: number;
  main_engine_kw: number;
  aux_engine_kw: number;
  propulsive_efficiency: number;
  current_fuel: string;
  compatible_fuels: string[];
  shore_power_capable: boolean;
  built_year: number;
  annual_distance_nm: number;
}

export interface Waypoint {
  lat: number;
  lon: number;
  name: string;
}

export interface Route {
  id: string;
  name: string;
  origin_port: string;
  destination_port: string;
  distance_nm: number;
  cargo_demand_t: number;
  revenue_usd: number;
  eta_window_hours: number[];
  waypoints: Waypoint[];
  weather?: WeatherLeg[];
  max_wave_height_m?: number;
}

export interface WeatherLeg {
  leg_index: number;
  lat: number;
  lon: number;
  wind_speed_kn: number;
  wind_direction_deg: number;
  wave_height_m: number;
  wave_period_s: number;
  wave_direction_deg: number;
  current_speed_kn: number;
  current_direction_deg: number;
  sea_state: string;
  exposure: number;
}

export interface Port {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  shore_power: "available" | "planned" | "unavailable";
  shore_power_kw: number;
  electricity_usd_per_kwh: number;
  grid_ci_gco2_per_kwh: number;
  berth_fee_usd_per_day: number;
  notes: string;
}

export interface Fuel {
  id: string;
  name: string;
  short_name: string;
  family: "fossil" | "transitional" | "renewable";
  lhv_mj_per_kg: number;
  cf_tco2_per_tfuel: number;
  ef_ttw_gco2e_per_gfuel: number;
  ef_wtt_gco2e_per_mj: number;
  engine_efficiency: number;
  price_usd_per_tonne: number;
  density_kg_per_m3: number;
  sox_content_pct: number;
  color: string;
  eca_compliant: boolean;
  notes: string;
  ci_ttw_gco2e_per_mj?: number;
  ci_wtw_gco2e_per_mj?: number;
  cost_usd_per_gj?: number;
}

export interface CIIResult {
  attained_cii: number;
  required_cii: number;
  reference_cii: number;
  rating: CIIRating;
  rating_description: string;
  co2_emissions_t: number;
  capacity_dwt: number;
  distance_nm: number;
  year: number;
  reduction_factor_z: number;
  boundaries: Record<string, number>;
  margin_to_required_pct: number;
  margin_to_c_boundary_pct: number;
  is_compliant: boolean;
  annual_fuel_tonnes?: number;
}

export interface ResistanceBreakdown {
  calm_water_kn: number;
  friction_kn: number;
  residuary_kn: number;
  wind_kn: number;
  wave_kn: number;
  total_kn: number;
  shares_pct: { friction: number; residuary: number; wind: number; wave: number };
}

export interface PredictionLeg {
  leg: number;
  distance_nm: number;
  speed_kn: number;
  duration_hours: number;
  fuel_tonnes?: number;
  fuel_rate_kg_per_h: number;
  fuel_rate_std_kg_per_h?: number;
  epistemic_std_kg_per_h?: number;
  aleatoric_std_kg_per_h?: number;
  shaft_power_kw?: number;
  engine_load_pct?: number;
}

export interface PredictionResult {
  mode: "neural" | "physics";
  fuel_tonnes: number;
  fuel_tonnes_std: number;
  confidence_interval_95: [number, number];
  confidence_interval_68: [number, number];
  fuel_cost_usd: number;
  energy_mj: number;
  duration_hours: number;
  distance_nm: number;
  average_power_kw: number;
  physics_breakdown: ResistanceBreakdown;
  per_leg: PredictionLeg[];
  physics_estimate_tonnes: number;
  neural_estimate_tonnes: number | null;
  model_divergence_pct: number;
  epistemic_fraction: number | null;
  model_info: {
    mode: string;
    validation_mape_pct?: number;
    validation_mae_kg_per_h?: number;
    parameters?: number;
  };
  vessel: { id: string; name: string; ship_type: string; dwt: number };
  route: { id: string; name: string; waypoints: Waypoint[] };
  weather: WeatherLeg[];
  weather_source: string;
  speeds_kn: number[];
  fuel_id: string;
}

export interface FuelComparisonEntry {
  fuel_id: string;
  fuel_name: string;
  fuel_family: string;
  fuel_mass_t: number;
  fuel_volume_m3: number;
  fuel_cost_usd: number;
  fuel_energy_mj: number;
  co2_ttw_t: number;
  ghg_ttw_t: number;
  ghg_wtt_t: number;
  ghg_wtw_t: number;
  ci_ttw_gco2e_per_mj: number;
  ci_wtw_gco2e_per_mj: number;
  sox_t: number;
  nox_t: number;
  greenwash_risk: boolean;
  vessel_compatible?: boolean;
  delta_vs_baseline: {
    baseline_fuel: string;
    ghg_wtw_pct: number;
    ghg_ttw_pct: number;
    cost_pct: number;
    mass_pct: number;
    volume_pct: number;
  };
}

export interface FuelComparison {
  propulsive_energy_mj: number;
  baseline_fuel: string;
  fuels: FuelComparisonEntry[];
  best_wtw: string;
  best_cost: string;
  vessel?: { id: string; name: string; current_fuel: string; compatible_fuels: string[] };
  route?: { id: string; name: string };
  voyage?: { distance_nm: number; duration_hours: number; speed_kn: number; energy_mj: number };
  physics_breakdown?: ResistanceBreakdown;
}

export interface AnnealingTrace {
  step: number[];
  temperature: number[];
  transverse_field: number[];
  best_energy: number[];
  mean_energy: number[];
  acceptance_rate: number[];
  tunneling_events: number[];
}

export interface QPSOTrace {
  iteration: number[];
  best_fitness: number[];
  mean_fitness: number[];
  alpha: number[];
  swarm_diversity: number[];
}

export interface SpeedProfileLeg {
  leg: number;
  from: string;
  to: string;
  distance_nm: number;
  speed_kn: number;
  heading_deg: number;
  duration_hours: number;
  shaft_power_kw: number;
  engine_load_pct: number;
  energy_mj: number;
  resistance: Record<string, number>;
  weather: WeatherLeg;
}

export interface VoyagePlan {
  vessel_id: string;
  vessel_name: string;
  ship_type: string;
  dwt: number;
  route_id: string;
  route_name: string;
  route_waypoints: Waypoint[];
  distance_nm: number;
  fuel_id: string;
  shore_power: { selected: boolean; port_id: string; detail: ShorePowerResult | null };
  speeds_kn: number[];
  objectives: Record<string, number | string | boolean>;
  speed_profile: SpeedProfileLeg[];
  cii: CIIResult;
  emissions: Record<string, number | string>;
  qpso_trace: QPSOTrace;
  voyage_totals: {
    total_duration_hours: number;
    total_distance_nm: number;
    average_speed_kn: number;
    average_power_kw: number;
    total_energy_mj: number;
  };
}

export interface SolutionTotals {
  fuel_cost_usd: number;
  ghg_wtw_t: number;
  ghg_ttw_t: number;
  co2_ttw_t: number;
  delay_hours: number;
  compliance_risk: number;
  risk_adjusted_fuel_t: number;
  fuel_mass_t: number;
  duration_hours: number;
  distance_nm: number;
}

export interface ParetoSolution {
  solution_id: string;
  label: string;
  scenario_index: number;
  weights: Record<string, number>;
  qubo: {
    energy: number;
    trace: AnnealingTrace;
    steps_run: number;
    replicas: number;
    converged_at_step: number;
    tunneling_events: number;
    n_variables: number;
  };
  voyages: VoyagePlan[];
  totals: SolutionTotals;
  all_compliant: boolean;
  pareto_rank: number;
  is_pareto_optimal: boolean;
  crowding_distance: number | null;
  normalized_objectives: Record<string, number>;
}

export interface OptimizationResult {
  pareto_solutions: ParetoSolution[];
  all_solutions: ParetoSolution[];
  objective_names: string[];
  objective_labels: Record<string, string>;
  n_evaluated: number;
  n_pareto_optimal: number;
  runtime_seconds: number;
  front_summary: {
    min_fuel_cost_usd: number;
    max_fuel_cost_usd: number;
    min_ghg_wtw_t: number;
    max_ghg_wtw_t: number;
    baseline_cost_usd: number;
    baseline_ghg_t: number;
    best_cost_usd: number;
    best_ghg_t: number;
    cost_saving_usd: number;
    cost_saving_pct: number;
    ghg_saving_t: number;
    ghg_saving_pct: number;
  };
  configuration: Record<string, unknown>;
  weather: Record<string, WeatherLeg[]>;
}

export interface OptimizationProgressEvent {
  type?: string;
  task_id?: string;
  phase?: string;
  progress?: number;
  message?: string;
  step?: number;
  total_steps?: number;
  temperature?: number;
  transverse_field?: number;
  best_energy?: number;
  mean_energy?: number;
  acceptance_rate?: number;
  tunneling_events?: number;
  iteration?: number;
  total_iterations?: number;
  best_fitness?: number;
  alpha?: number;
  swarm_diversity?: number;
  scenario?: number;
  total_scenarios?: number;
  weights?: Record<string, number>;
  status?: string;
  error?: string;
  result?: OptimizationResult;
  events?: OptimizationProgressEvent[];
}

export interface ShorePowerResult {
  port_id: string;
  port_name: string;
  berth_hours: number;
  auxiliary_load_kw: number;
  energy_kwh: number;
  feasible: boolean;
  blockers: string[];
  auxiliary_option: {
    fuel_id: string;
    fuel_mass_t: number;
    cost_usd: number;
    co2_ttw_t: number;
    ghg_ttw_t: number;
    ghg_wtw_t: number;
  };
  shore_power_option: {
    grid_energy_kwh: number;
    grid_ci_gco2_per_kwh: number;
    cost_usd: number;
    ghg_ttw_t: number;
    ghg_wtw_t: number;
  };
  cost_saving_usd: number;
  ghg_saving_wtw_t: number;
  co2_saving_ttw_t: number;
  environmentally_beneficial: boolean;
  recommended: boolean;
  rationale: string;
}

export interface SEEMPMeasure {
  id: string;
  name: string;
  reduction_pct: number;
  capex_usd: number;
  opex_delta_usd_per_year: number;
  lead_time_days: number;
  category: string;
  description: string;
}

export interface SEEMPPlan {
  action_required: boolean;
  urgency: string;
  rating: CIIRating;
  required_reduction_pct: number;
  recommended_measures: SEEMPMeasure[];
  achieved_reduction_pct: number;
  projected_cii?: number;
  projected_rating: CIIRating;
  total_capex_usd: number;
  annual_opex_delta_usd: number;
  statutory_note: string;
}

export interface DashboardSummary {
  year: number;
  reduction_factor_z_pct: number;
  kpis: {
    fleet_size: number;
    total_dwt: number;
    annual_fuel_tonnes: number;
    annual_co2_tonnes: number;
    annual_ghg_wtw_tonnes: number;
    annual_fuel_cost_usd: number;
    wtt_share_pct: number;
    compliant_vessels: number;
    at_risk_vessels: number;
    optimizations_run: number;
    realised_cost_saving_usd: number;
    realised_ghg_saving_t: number;
  };
  cii_distribution: Record<CIIRating, number>;
  rating_labels: Record<string, { label: string; description: string; color: string }>;
  vessels: Array<{
    id: string;
    name: string;
    ship_type: string;
    dwt: number;
    current_fuel: string;
    speed_service_kn: number;
    shore_power_capable: boolean;
    built_year: number;
    rating: CIIRating;
    attained_cii: number;
    required_cii: number;
    margin_pct: number;
    annual_fuel_tonnes: number;
    annual_co2_t: number;
    annual_cost_usd: number;
    position: { lat: number; lon: number; route_id: string; route_name: string; near: string } | null;
  }>;
  emissions_by_fuel: Array<{
    fuel_id: string;
    fuel_name: string;
    color: string;
    fuel_tonnes: number;
    ghg_ttw_t: number;
    ghg_wtt_t: number;
    ghg_wtw_t: number;
  }>;
  routes: Route[];
  ports: Port[];
  recent_optimizations: Array<{
    id: string;
    status: string;
    created_at: string;
    n_pareto: number;
    runtime_seconds: number;
    best_cost_usd: number;
  }>;
  active_tasks: Array<{ task_id: string; status: string; progress: number; phase: string }>;
}

export interface Formula {
  name: string;
  latex: string;
  description: string;
}
