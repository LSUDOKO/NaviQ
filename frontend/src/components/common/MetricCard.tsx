import type { ReactNode } from "react";

interface MetricCardProps {
  label: string; value: ReactNode; unit?: string; hint?: string;
  icon?: ReactNode;
  delta?: { text: string; tone: "good" | "warn" | "bad" | "info" | "neutral" } | null;
  accent?: "signal" | "warn" | "plain";
}

/** A KPI card: icon chip, label, large figure, and a pill for the qualifier. */
export function MetricCard({ label, value, unit, hint, icon, delta = null, accent = "plain" }: MetricCardProps) {
  const color = accent === "signal" ? "text-signal" : accent === "warn" ? "text-warn" : "text-txt-primary";
  return (
    <div className="panel px-5 py-4">
      <div className="flex items-center gap-2.5 mb-3">
        {icon && <span className="icon-chip">{icon}</span>}
        <p className="text-sm font-medium text-txt-secondary flex-1">{label}</p>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className={`metric metric-xl ${color}`}>{value}</span>
        {unit && <span className="text-xs unit">{unit}</span>}
      </p>
      {(delta || hint) && (
        <p className="mt-2.5 flex items-center gap-2 text-2xs text-txt-quiet">
          {delta && <span className={`pill pill-${delta.tone}`}>{delta.text}</span>}
          {hint && <span>{hint}</span>}
        </p>
      )}
    </div>
  );
}
export default MetricCard;
