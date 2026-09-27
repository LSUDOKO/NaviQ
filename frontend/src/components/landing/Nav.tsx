import { useState } from "react";
import { Link } from "react-router-dom";
import { BlackButton } from "./ui";

const LINKS = [
  { label: "Prediction", to: "/app/prediction" },
  { label: "Optimisation", to: "/app/optimization" },
  { label: "Compliance", to: "/app/compliance" },
  { label: "Fleet", to: "/app/fleet" },
];

export function Mark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="w-7 h-7 rounded-[8px] bg-[#0B0D0F] text-white flex items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13h14l-1.6 3H4.6zM5 13V8.5h10V13M10 8.5V4" /></svg>
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#0B0D0F]">NAVIQ</span>
    </span>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="flex items-center justify-between h-[68px]">
          <Link to="/" aria-label="NAVIQ home"><Mark /></Link>

          <nav className="hidden md:flex items-center gap-8" aria-label="Product areas">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="text-[14px] font-medium text-[#0B0D0F] hover:text-[#1775E8] transition-colors">{l.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <BlackButton to="/app" size="sm" className="hidden sm:inline-flex">Open console</BlackButton>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Menu"
              className="md:hidden w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-[#0B0D0F]">
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                {open ? <path d="m5 5 10 10M15 5 5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav className="md:hidden mt-1 rounded-[14px] bg-white border border-[#E8E8E8] shadow-pop p-2" aria-label="Product areas">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="block px-3 py-2.5 rounded-[10px] text-[14px] font-medium text-[#0B0D0F] hover:bg-[#F7F8FA]">{l.label}</Link>
            ))}
            <Link to="/app" className="mt-1 block text-center rounded-full bg-[#0B0D0F] text-white text-[14px] font-medium py-2.5">Open console</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
