import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  trend?: { value: string; positive: boolean } | null;
  accent?: "teal" | "amber" | "slate";
}

/**
 * A single readout. The figure is the hero: large, monospaced and tabular so
 * columns of these line up like a real instrument stack.
 */
export function MetricCard({
  label,
  value,
  unit,
  hint,
  trend = null,
  accent = "slate",
}: MetricCardProps) {
  const accentClass =
    accent === "teal" ? "text-teal" : accent === "amber" ? "text-amber" : "text-slate-50";

  return (
    <div className="panel px-4 py-3.5">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className={`metric text-2xl font-semibold ${accentClass}`}>{value}</span>
        {unit && <span className="text-xs unit">{unit}</span>}
      </p>
      {(hint || trend) && (
        <p className="mt-1.5 flex items-center gap-2 text-2xs">
          {trend && (
            <span className={trend.positive ? "text-cii-a" : "text-cii-e"}>{trend.value}</span>
          )}
          {hint && <span className="text-slate-500">{hint}</span>}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
