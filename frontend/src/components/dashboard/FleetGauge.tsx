import { CII_COLORS } from "../../utils/constants";
import type { CIIRating } from "../../types";

interface Props { vessels: Array<{ id: string; rating: CIIRating }>; compliantPct: number }

/**
 * A segmented arc, one block per vessel coloured by its rating, so the gauge
 * shows composition and headline at once. Blocks are drawn as thick strokes on
 * a half-circle path; the gap between them is the dash pattern.
 */
export function FleetGauge({ vessels, compliantPct }: Props) {
  const n = Math.max(vessels.length, 1);
  const R = 84, cx = 110, cy = 104, sw = 24;
  const circumference = Math.PI * R; // half circle
  const gap = 5;
  const seg = (circumference - gap * (n - 1)) / n;
  const order: CIIRating[] = ["A", "B", "C", "D", "E"];
  const sorted = [...vessels].sort((a, b) => order.indexOf(a.rating) - order.indexOf(b.rating));

  return (
    <svg viewBox="0 0 220 120" className="w-full max-w-[260px] mx-auto" role="img" aria-label={`${compliantPct}% of the fleet within limits`}>
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="#EEF0F4" strokeWidth={sw} strokeLinecap="butt" />
      {sorted.map((v, i) => (
        <path key={v.id} d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none"
          stroke={CII_COLORS[v.rating]} strokeWidth={sw} strokeLinecap="butt"
          strokeDasharray={`${seg} ${circumference}`} strokeDashoffset={-(i * (seg + gap))} />
      ))}
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize="30" fontWeight="600" fill="#111827" letterSpacing="-0.02em">{compliantPct}%</text>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10.5" fill="#6B7280">Within CII limits</text>
    </svg>
  );
}
export default FleetGauge;
