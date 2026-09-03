import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  accent?: "signal" | "warn" | "plain";
  size?: "md" | "lg";
}

/**
 * A single readout.
 *
 * The figure is the content and everything else is annotation, so the number
 * gets the monospaced face and the top of the type scale while the label sits
 * quietly beneath it. Sentence case throughout: tracked-out capitals above every
 * value is the house style of dashboards that have nothing to say.
 */
export function MetricCard({
  label,
  value,
  unit,
  hint,
  accent = "plain",
  size = "md",
}: MetricCardProps) {
  const accentClass =
    accent === "signal" ? "text-signal" : accent === "warn" ? "text-warn" : "text-txt-primary";

  return (
    <div className="panel px-4 py-3.5">
      <p className="text-2xs text-txt-tertiary mb-2.5">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className={`metric ${size === "lg" ? "metric-xl" : "metric-lg"} ${accentClass}`}>
          {value}
        </span>
        {unit && <span className="text-2xs unit">{unit}</span>}
      </p>
      {hint && <p className="caption-quiet mt-2">{hint}</p>}
    </div>
  );
}

export default MetricCard;
