import { Link } from "react-router-dom";
import { EmptyState } from "../common/LoadingSpinner";
import { int, num, usd } from "../../utils/formatters";

export interface RunSummary {
  id: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  vessel_ids: string[];
  route_ids: string[];
  n_solutions: number;
  n_pareto: number;
  runtime_seconds: number;
  best_cost_usd: number;
  best_ghg_t: number;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Optimisation runs recorded this session, newest first. */
export function RecentRuns({ runs }: { runs: RunSummary[] }) {
  if (!runs.length) {
    return (
      <EmptyState
        title="No optimisation runs yet"
        hint="Run one from the Optimisation page and the plans it finds will be summarised here."
      />
    );
  }
  return (
    <ul className="divide-y divide-ink-line">
      {runs.slice(0, 6).map((r) => (
        <li key={r.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-txt-primary">
              {r.n_pareto} plan{r.n_pareto === 1 ? "" : "s"} on the frontier
            </span>
            <span className="text-2xs text-txt-quiet shrink-0">{when(r.completed_at ?? r.created_at)}</span>
          </div>
          <p className="caption mt-0.5">
            {r.vessel_ids.length} vessel{r.vessel_ids.length === 1 ? "" : "s"} · {r.route_ids.length} route{r.route_ids.length === 1 ? "" : "s"} ·
            best {usd(r.best_cost_usd, true)} · {int(r.best_ghg_t)} t CO₂e · {num(r.runtime_seconds, 0)} s
          </p>
        </li>
      ))}
      <li className="pt-3">
        <Link to="/app/optimization" className="text-xs font-medium text-signal">Open the optimiser</Link>
      </li>
    </ul>
  );
}
export default RecentRuns;
