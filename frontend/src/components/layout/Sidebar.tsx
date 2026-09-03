import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { useAsync } from "../../hooks/usePrediction";
import api from "../../services/api";

interface NavItem { to: string; label: string; icon: ReactElement; badge?: string }

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  grid: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>,
  gauge: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><path d="M3 13.5a7 7 0 0 1 14 0"/><path d="M10 13.5l3.5-4"/><circle cx="10" cy="13.5" r="1.2"/></svg>,
  nodes: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><circle cx="5" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="10" cy="15" r="2"/><path d="M6.6 7.4 8.8 13m4.6-5.6L11.2 13M7 6h6"/></svg>,
  shield: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><path d="M10 2.5 16.5 5v5c0 4-2.8 6.4-6.5 7.5C6.3 16.4 3.5 14 3.5 10V5z"/><path d="M7.5 10l1.8 1.8L13 8"/></svg>,
  ship: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><path d="M2.5 13.5h15l-1.6 3.5H4.1zM4.5 13.5V8h11v5.5M10 8V4.5M7 4.5h6"/></svg>,
  info: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.6v.5"/></svg>,
  doc: <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><path d="M6 3h6l4 4v10H6z"/><path d="M12 3v4h4M8.5 11h5M8.5 14h5"/></svg>,
};

const MAIN: NavItem[] = [
  { to: "/", label: "Dashboard", icon: I.grid },
  { to: "/prediction", label: "Prediction", icon: I.gauge },
  { to: "/optimization", label: "Optimisation", icon: I.nodes },
  { to: "/compliance", label: "Compliance", icon: I.shield },
  { to: "/fleet", label: "Fleet", icon: I.ship },
];
const MORE: NavItem[] = [
  { to: "/about", label: "About", icon: I.info },
];

function Item({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink to={item.to} end={item.to === "/"} onClick={onNavigate}
      className={({ isActive }) => ["group flex items-center gap-3 mx-3 px-3 py-[9px] rounded-[10px] text-[13.5px] font-medium transition-colors",
        isActive ? "bg-ink-800/70 text-txt-primary" : "text-txt-secondary hover:bg-ink-850 hover:text-txt-primary"].join(" ")}>
      {({ isActive }) => (<>
        <span className={isActive ? "text-txt-primary" : "text-txt-tertiary group-hover:text-txt-primary"}>{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.badge && <span className="pill pill-info">{item.badge}</span>}
      </>)}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const model = useAsync<{ mode: string; metrics: { final_val_mape_pct?: number } }>(() => api.modelInfo(), []);
  const mape = model.data?.metrics?.final_val_mape_pct;

  return (
    <nav className="h-full flex flex-col bg-ink-900 border-r border-ink-line" aria-label="Main">
      <div className="flex items-center gap-2.5 px-6 pt-6 pb-5">
        <span className="w-8 h-8 rounded-[9px] bg-signal text-white flex items-center justify-center shadow-[0_1px_2px_rgba(37,99,235,0.35)]" aria-hidden="true">
          <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13h14l-1.6 3H4.6zM5 13V8.5h10V13M10 8.5V4"/></svg>
        </span>
        <span className="text-[19px] font-semibold tracking-[-0.02em] text-txt-primary">NAVIQ</span>
      </div>

      <p className="px-6 mb-1.5 text-2xs font-medium text-txt-quiet">Main menu</p>
      <ul className="space-y-0.5">{MAIN.map((it) => <li key={it.to}><Item item={it} onNavigate={onNavigate} /></li>)}</ul>

      <p className="px-6 mt-6 mb-1.5 text-2xs font-medium text-txt-quiet">Resources</p>
      <ul className="space-y-0.5">
        {MORE.map((it) => <li key={it.to}><Item item={it} onNavigate={onNavigate} /></li>)}
        <li>
          <a href="/docs" target="_blank" rel="noreferrer"
             className="group flex items-center gap-3 mx-3 px-3 py-[9px] rounded-[10px] text-[13.5px] font-medium text-txt-secondary hover:bg-ink-850 hover:text-txt-primary transition-colors">
            <span className="text-txt-tertiary group-hover:text-txt-primary">{I.doc}</span>API reference
          </a>
        </li>
      </ul>

      <div className="flex-1" />

      <div className="mx-4 mb-4 rounded-card bg-ink-850 border border-ink-line p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-good" aria-hidden="true" />
          <p className="text-sm font-semibold text-txt-primary">{model.data?.mode === "neural" ? "Neural model live" : "Physics model live"}</p>
        </div>
        <p className="caption-quiet mb-3">
          {mape !== undefined ? `Physics-informed BiLSTM, ${mape.toFixed(2)}% validation error.` : "Holtrop–Mennen analytic predictor."}
        </p>
        <a href="/docs" target="_blank" rel="noreferrer" className="btn btn-primary w-full text-xs py-2">Open API docs</a>
      </div>
      <p className="px-6 pb-4 text-2xs text-txt-quiet">SIH 2026 · SIH26138</p>
    </nav>
  );
}
export default Sidebar;
