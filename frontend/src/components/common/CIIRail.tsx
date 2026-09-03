import type { CIIRating } from "../../types";
import { CII_COLORS, CII_ORDER } from "../../utils/constants";
import { num } from "../../utils/formatters";

interface CIIRailProps {
  attained: number;
  required: number;
  boundaries: Record<string, number>;
  rating: CIIRating;
  size?: "sm" | "md" | "lg";
  showScale?: boolean;
}

/**
 * The A-E rating rail.
 *
 * Every other CII display in the industry is a letter in a coloured box, which
 * tells an operator nothing about how close they are to the next band. This
 * plots the attained value against the real MEPC boundaries, so the margin --
 * the thing that actually decides whether next year is a problem -- is the
 * visible quantity.
 */
export function CIIRail({
  attained,
  required,
  boundaries,
  rating,
  size = "md",
  showScale = true,
}: CIIRailProps) {
  const a = boundaries.A_upper ?? required * 0.85;
  const b = boundaries.B_upper ?? required * 0.95;
  const c = boundaries.C_upper ?? required * 1.06;
  const d = boundaries.D_upper ?? required * 1.18;

  // The rail spans from comfortably inside A to comfortably past E, so a vessel
  // at either extreme still lands on the scale rather than clipping off it.
  const railMin = a * 0.62;
  const railMax = d * 1.2;
  const span = Math.max(railMax - railMin, 1e-9);

  const toPct = (value: number) =>
    Math.max(0, Math.min(100, ((value - railMin) / span) * 100));

  const bands: Array<{ grade: CIIRating; from: number; to: number }> = [
    { grade: "A", from: railMin, to: a },
    { grade: "B", from: a, to: b },
    { grade: "C", from: b, to: c },
    { grade: "D", from: c, to: d },
    { grade: "E", from: d, to: railMax },
  ];

  const markerPct = toPct(attained);
  const heights = { sm: "h-2", md: "h-3", lg: "h-5" };

  return (
    <div className="w-full">
      <div className={`relative ${heights[size]} rounded-sm overflow-hidden flex`}>
        {bands.map((band) => (
          <div
            key={band.grade}
            style={{
              width: `${toPct(band.to) - toPct(band.from)}%`,
              backgroundColor: CII_COLORS[band.grade],
              opacity: band.grade === rating ? 0.95 : 0.28,
            }}
            className="h-full transition-opacity"
            title={`${band.grade}: up to ${num(band.to, 2)}`}
          />
        ))}

        {/* The required line: the regulator's threshold for this year. */}
        <div
          className="absolute top-0 bottom-0 w-px bg-slate-100/70"
          style={{ left: `${toPct(required)}%` }}
          title={`Required ${num(required, 2)}`}
        />

        {/* The vessel's own position. */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: `${markerPct}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-1 h-full bg-navy-950" />
          <div
            className="absolute w-2.5 h-2.5 rounded-full border-2 border-navy-950"
            style={{ backgroundColor: CII_COLORS[rating] }}
          />
        </div>
      </div>

      {showScale && (
        <div className="flex justify-between mt-1.5 text-2xs text-slate-600 font-mono tabular">
          {CII_ORDER.map((grade) => (
            <span key={grade} style={{ color: grade === rating ? CII_COLORS[grade] : undefined }}>
              {grade}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** The rating letter as a compact badge, for tables and dense lists. */
export function CIIBadge({ rating, size = "md" }: { rating: CIIRating; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "w-5 h-5 text-2xs" : "w-7 h-7 text-sm";
  return (
    <span
      className={`${dimensions} inline-flex items-center justify-center rounded-sm font-mono font-bold shrink-0`}
      style={{
        backgroundColor: `${CII_COLORS[rating]}22`,
        color: CII_COLORS[rating],
        border: `1px solid ${CII_COLORS[rating]}55`,
      }}
      title={`CII rating ${rating}`}
    >
      {rating}
    </span>
  );
}

export default CIIRail;
