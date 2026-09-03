/** Compact number with a sensible number of significant digits. */
export function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function int(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}

/** Money, abbreviated once it stops being readable in full. */
export function usd(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function tonnes(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}Mt`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}kt`;
  return `${num(value, digits)} t`;
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "" : ""}${num(value, digits)}%`;
}

export function signedPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${num(value, digits)}%`;
}

/** Duration in days and hours; "312 h" means nothing to a scheduler. */
export function duration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "—";
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  if (days === 0) return `${Math.round(hours)} h`;
  return `${days}d ${rest}h`;
}

export function nm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${int(value)} nm`;
}

export function knots(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${num(value, digits)} kn`;
}

export function power(kw: number | null | undefined): string {
  if (kw === null || kw === undefined || !Number.isFinite(kw)) return "—";
  return kw >= 1000 ? `${num(kw / 1000, 2)} MW` : `${int(kw)} kW`;
}

export function probability(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value < 0.001 && value > 0) return "<0.1%";
  return `${num(value * 100, 1)}%`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
