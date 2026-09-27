import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAsync } from "../../hooks/usePrediction";
import api from "../../services/api";
import { SHIP_TYPE_LABELS } from "../../utils/constants";

interface HeaderProps { title: string; description: string; onMenuClick: () => void }
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function Header({ title, onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLLabelElement>(null);

  const vessels = useAsync(() => api.listVessels(), []);
  const summary = useAsync(() => api.dashboardSummary(2026), []);
  const atRisk = summary.data?.kpis.at_risk_vessels ?? 0;

  useEffect(() => {
    let cancelled = false;
    const check = () => fetch("/api/v1/model/info").then((r) => { if (!cancelled) setOffline(!r.ok); }).catch(() => { if (!cancelled) setOffline(true); });
    check(); const t = window.setInterval(check, 30_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? (vessels.data ?? []).filter((v) => `${v.name} ${v.imo} ${SHIP_TYPE_LABELS[v.ship_type] ?? v.ship_type} ${v.current_fuel}`.toLowerCase().includes(needle)).slice(0, 6)
    : [];

  const go = (id: string) => { setQuery(""); setOpen(false); navigate(`/app/fleet?vessel=${id}`); };

  return (
    <header className="sticky top-0 z-30 bg-ink-900 border-b border-ink-line">
      <div className="flex items-center gap-4 px-5 sm:px-7 h-[60px]">
        <button type="button" onClick={onMenuClick} className="lg:hidden text-txt-secondary p-1 -ml-1" aria-label="Open navigation">
          <svg viewBox="0 0 20 20" className="w-5 h-5" {...s}><path d="M3 6h14M3 10h14M3 14h14"/></svg>
        </button>
        <h1 className="text-[15px] font-semibold text-txt-primary shrink-0">{title}</h1>

        <label ref={boxRef} className="hidden md:flex relative items-center gap-2 flex-1 max-w-md h-9 px-3 rounded-[10px] bg-ink-850 border border-ink-line text-txt-quiet focus-within:border-signal focus-within:bg-white transition-colors">
          <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" {...s}><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3 3"/></svg>
          <input className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-quiet outline-none" placeholder="Search vessels by name, IMO, type or fuel…"
            value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) go(matches[0].id); if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
            aria-label="Search vessels" aria-expanded={open && matches.length > 0} />
          <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] text-txt-quiet border border-ink-bright rounded px-1.5 py-0.5">↵</kbd>

          {open && needle && (
            <ul className="absolute left-0 right-0 top-[calc(100%+6px)] panel shadow-pop p-1.5 z-40" role="listbox">
              {matches.length === 0 && <li className="px-3 py-2 text-xs text-txt-tertiary">No vessel matches “{query}”.</li>}
              {matches.map((v) => (
                <li key={v.id} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(v.id)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] text-left hover:bg-ink-850">
                    <span className="text-sm text-txt-primary truncate">{v.name}</span>
                    <span className="text-2xs text-txt-quiet shrink-0">{SHIP_TYPE_LABELS[v.ship_type] ?? v.ship_type} · IMO {v.imo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1.5 shrink-0">
          {offline && <span className="pill pill-bad mr-1">Backend offline</span>}
          <a href="/docs" target="_blank" rel="noreferrer" title="API reference" className="w-9 h-9 rounded-full border border-ink-line flex items-center justify-center text-txt-secondary hover:bg-ink-850 transition-colors">
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><circle cx="10" cy="10" r="7.5"/><path d="M8 8a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.6M10 14.2v.3"/></svg>
          </a>
          <Link to="/app/compliance" title={atRisk > 0 ? `${atRisk} vessel${atRisk === 1 ? "" : "s"} at risk of a D or E rating` : "No vessels at risk"}
            className="relative w-9 h-9 rounded-full border border-ink-line flex items-center justify-center text-txt-secondary hover:bg-ink-850 transition-colors">
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13zM8.5 17a1.5 1.5 0 0 0 3 0"/></svg>
            {atRisk > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white text-[10px] font-semibold flex items-center justify-center">{atRisk}</span>}
          </Link>
          <span className="ml-1 w-9 h-9 rounded-full bg-gradient-to-br from-signal to-sea text-white text-xs font-semibold flex items-center justify-center" title="Fleet operator">FO</span>
        </div>
      </div>
    </header>
  );
}
export default Header;
