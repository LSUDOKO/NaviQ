import { useEffect, useState } from "react";

interface HeaderProps { title: string; description: string; onMenuClick: () => void }
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function Header({ title, onMenuClick }: HeaderProps) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = () => fetch("/api/v1/model/info").then((r) => { if (!cancelled) setOffline(!r.ok); }).catch(() => { if (!cancelled) setOffline(true); });
    check(); const t = window.setInterval(check, 30_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-ink-900 border-b border-ink-line">
      <div className="flex items-center gap-4 px-5 sm:px-7 h-[60px]">
        <button type="button" onClick={onMenuClick} className="lg:hidden text-txt-secondary p-1 -ml-1" aria-label="Open navigation">
          <svg viewBox="0 0 20 20" className="w-5 h-5" {...s}><path d="M3 6h14M3 10h14M3 14h14"/></svg>
        </button>
        <h1 className="text-[15px] font-semibold text-txt-primary shrink-0">{title}</h1>

        <label className="hidden md:flex items-center gap-2 flex-1 max-w-md h-9 px-3 rounded-[10px] bg-ink-850 border border-ink-line text-txt-quiet focus-within:border-signal focus-within:bg-white transition-colors">
          <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" {...s}><circle cx="9" cy="9" r="5.5"/><path d="m13.5 13.5 3 3"/></svg>
          <input className="flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-quiet outline-none" placeholder="Search vessels, routes, or plans…" />
          <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] text-txt-quiet border border-ink-bright rounded px-1.5 py-0.5">⌘ K</kbd>
        </label>

        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1.5 shrink-0">
          {offline && <span className="pill pill-bad mr-1">Backend offline</span>}
          <a href="/docs" target="_blank" rel="noreferrer" title="API reference" className="w-9 h-9 rounded-full border border-ink-line flex items-center justify-center text-txt-secondary hover:bg-ink-850 transition-colors">
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><circle cx="10" cy="10" r="7.5"/><path d="M8 8a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.6M10 14.2v.3"/></svg>
          </a>
          <button type="button" title="Notifications" className="w-9 h-9 rounded-full border border-ink-line flex items-center justify-center text-txt-secondary hover:bg-ink-850 transition-colors">
            <svg viewBox="0 0 20 20" className="w-[17px] h-[17px]" {...s}><path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13zM8.5 17a1.5 1.5 0 0 0 3 0"/></svg>
          </button>
          <span className="ml-1 w-9 h-9 rounded-full bg-gradient-to-br from-signal to-sky-400 text-white text-xs font-semibold flex items-center justify-center" title="Fleet operator">FO</span>
        </div>
      </div>
    </header>
  );
}
export default Header;
