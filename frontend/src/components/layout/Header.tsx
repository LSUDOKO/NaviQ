import { useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  description: string;
  onMenuClick: () => void;
}

export function Header({ title, description, onMenuClick }: HeaderProps) {
  const [health, setHealth] = useState<{ status: string; predictor_mode: string } | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/v1/model/info")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unhealthy"))))
        .then((data) => {
          if (!cancelled) {
            setHealth({ status: "ok", predictor_mode: data.mode });
            setOffline(false);
          }
        })
        .catch(() => {
          if (!cancelled) setOffline(true);
        });

    check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-ink-950/90 backdrop-blur-sm border-b border-ink-line">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3.5">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden text-txt-secondary hover:text-signal p-1 -ml-1"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-base font-medium text-txt-primary truncate leading-tight">{title}</h1>
          <p className="text-2xs text-txt-tertiary truncate mt-0.5">{description}</p>
        </div>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {offline ? (
            <span className="chip bg-cii-e/10 text-cii-e border border-cii-e/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cii-e" aria-hidden="true" />
              Backend offline
            </span>
          ) : (
            <span className="chip bg-signal/[0.08] text-signal border border-signal/25">
              <span className="w-1.5 h-1.5 rounded-full bg-signal" aria-hidden="true" />
              {health?.predictor_mode === "neural" ? "Neural model live" : "Physics model live"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
