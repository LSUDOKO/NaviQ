import { CIIBadge } from "../common/CIIRail";
import Panel from "../common/Panel";
import type { CIIResult, SEEMPPlan } from "../../types";
import { int, num, pct, usd } from "../../utils/formatters";

interface VesselEntry {
  vessel_id: string;
  vessel_name: string;
  cii: CIIResult;
  seemp: SEEMPPlan;
}

const CATEGORY_LABELS: Record<string, string> = {
  operational: "Operational",
  maintenance: "Maintenance",
  capex: "Capital",
};

/**
 * Corrective action planning for vessels heading out of compliance.
 *
 * Measures are ranked by capital cost per point of intensity reduction, and
 * their effects compound rather than add — two measures at 10% each leave 81%,
 * not 80%. Showing the bundle and its projected rating is what makes this a
 * plan rather than a warning.
 */
export function SEEMPPanel({ vessels }: { vessels: VesselEntry[] }) {
  const actionable = vessels.filter((v) => v.seemp.action_required);

  if (actionable.length === 0) {
    return (
      <Panel title="Corrective action" subtitle="Vessels approaching the compliance boundary">
        <p className="text-sm text-txt-secondary">
          Every vessel is rated C or better. No corrective action plan is required under SEEMP
          Part III.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Corrective action"
      subtitle={`${actionable.length} vessel${actionable.length === 1 ? "" : "s"} need a plan under SEEMP Part III`}
    >
      <div className="space-y-6">
        {actionable.map((entry) => {
          const plan = entry.seemp;
          return (
            <article key={entry.vessel_id} className="border border-ink-700/60 rounded-sm p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <CIIBadge rating={entry.cii.rating} size="sm" />
                  <h3 className="text-sm font-medium text-txt-primary">{entry.vessel_name}</h3>
                  <span className="text-txt-quiet" aria-hidden="true">→</span>
                  <CIIBadge rating={plan.projected_rating} size="sm" />
                </div>
                <span
                  className={`chip border ${
                    plan.urgency === "critical"
                      ? "bg-cii-e/12 text-cii-e border-cii-e/30"
                      : "bg-warn/12 text-warn border-warn/30"
                  }`}
                >
                  {plan.urgency === "critical" ? "Immediate" : "Plan required"}
                </span>
              </header>

              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div>
                  <p className="text-2xs text-txt-tertiary mb-1">Reduction needed</p>
                  <p className="metric text-lg text-txt-primary">
                    {pct(plan.required_reduction_pct, 1)}
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-txt-tertiary mb-1">This bundle delivers</p>
                  <p className="metric text-lg text-cii-a">{pct(plan.achieved_reduction_pct, 1)}</p>
                </div>
                <div>
                  <p className="text-2xs text-txt-tertiary mb-1">Capital required</p>
                  <p className="metric text-lg text-txt-primary">
                    {plan.total_capex_usd > 0 ? usd(plan.total_capex_usd, true) : "None"}
                  </p>
                  {plan.annual_opex_delta_usd < 0 && (
                    <p className="text-2xs text-cii-a mt-0.5">
                      Saves {usd(Math.abs(plan.annual_opex_delta_usd), true)} a year
                    </p>
                  )}
                </div>
              </div>

              <ol className="space-y-2.5">
                {plan.recommended_measures.map((measure) => (
                  <li
                    key={measure.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs border-l-2 border-signal/40 pl-3 py-0.5"
                  >
                    <span className="text-txt-primary font-medium">{measure.name}</span>
                    <span className="chip bg-ink-800 text-txt-tertiary border border-ink-700">
                      {CATEGORY_LABELS[measure.category] ?? measure.category}
                    </span>
                    <span className="metric text-cii-a">−{num(measure.reduction_pct, 1)}%</span>
                    <span className="metric text-txt-tertiary">
                      {measure.capex_usd > 0 ? usd(measure.capex_usd, true) : "no capex"}
                    </span>
                    <span className="text-txt-quiet">
                      {measure.lead_time_days === 0
                        ? "immediate"
                        : `${int(measure.lead_time_days)} days lead`}
                    </span>
                    <p className="w-full text-2xs text-txt-quiet leading-relaxed mt-0.5">
                      {measure.description}
                    </p>
                  </li>
                ))}
              </ol>

              <p className="text-2xs text-txt-tertiary mt-4 pt-3 border-t border-ink-700/70 leading-relaxed">
                {plan.statutory_note}
              </p>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export default SEEMPPanel;
