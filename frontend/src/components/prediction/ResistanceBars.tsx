import type { ResistanceBreakdown } from "../../types";
import { num, pct } from "../../utils/formatters";

const COMPONENTS = [
  {
    key: "friction" as const,
    field: "friction_kn" as const,
    label: "Skin friction",
    color: "#00BFA6",
    note: "Water shearing along the wetted hull. Dominant on full-form hulls at low speed, and the reason fouling costs so much.",
  },
  {
    key: "residuary" as const,
    field: "residuary_kn" as const,
    label: "Wave-making",
    color: "#2DE3C8",
    note: "The hull's own wave system. Rises steeply with Froude number, which is what makes slow steaming effective.",
  },
  {
    key: "wave" as const,
    field: "wave_kn" as const,
    label: "Added resistance in waves",
    color: "#F59E0B",
    note: "Scales with the square of significant wave height. A 3 m sea costs nine times a 1 m sea.",
  },
  {
    key: "wind" as const,
    field: "wind_kn" as const,
    label: "Wind on the superstructure",
    color: "#38BDF8",
    note: "Apparent wind against the above-water body. A following wind reduces it.",
  },
];

export function ResistanceBars({ breakdown }: { breakdown: ResistanceBreakdown }) {
  const total = Math.max(breakdown.total_kn, 1e-9);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-xs text-slate-500">Total resistance</span>
        <span className="metric text-xl text-slate-50">
          {num(breakdown.total_kn, 0)} <span className="text-xs unit">kN</span>
        </span>
      </div>

      {/* One stacked rail: proportions are the point, not four separate bars. */}
      <div className="h-3 rounded-sm overflow-hidden flex mb-5">
        {COMPONENTS.map((component) => {
          const value = Math.max(breakdown[component.field], 0);
          const share = (value / total) * 100;
          if (share <= 0.1) return null;
          return (
            <div
              key={component.key}
              style={{ width: `${share}%`, backgroundColor: component.color }}
              title={`${component.label}: ${num(value, 1)} kN`}
            />
          );
        })}
      </div>

      <dl className="space-y-3">
        {COMPONENTS.map((component) => {
          const value = breakdown[component.field];
          const share = (Math.max(value, 0) / total) * 100;
          return (
            <div key={component.key}>
              <div className="flex items-baseline gap-2.5">
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: component.color }}
                  aria-hidden="true"
                />
                <dt className="text-xs text-slate-300 flex-1">{component.label}</dt>
                <dd className="metric text-xs text-slate-400">
                  {num(value, 1)} <span className="unit">kN</span>
                </dd>
                <dd className="metric text-xs text-slate-500 w-12 text-right">{pct(share, 0)}</dd>
              </div>
              <p className="text-2xs text-slate-600 ml-4.5 mt-0.5 leading-relaxed pl-1">
                {component.note}
              </p>
            </div>
          );
        })}
      </dl>

      {breakdown.wind_kn < 0 && (
        <p className="mt-4 pt-3 border-t border-navy-700/70 text-2xs text-cii-a leading-relaxed">
          Wind resistance is negative on this voyage: a following wind is producing thrust rather
          than drag, and the fuel figure already accounts for it.
        </p>
      )}
    </div>
  );
}

export default ResistanceBars;
