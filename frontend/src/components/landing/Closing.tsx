import { Link } from "react-router-dom";
import { Mark } from "./Nav";
import { ArrowDown, BlackButton } from "./ui";

export function FinalCta() {
  return (
    <section className="px-3 sm:px-4 pt-20 sm:pt-24">
      <div className="sky-panel relative overflow-hidden rounded-[22px] sm:rounded-[28px] py-24 sm:py-32 text-center">
        <span className="absolute left-1/2 -translate-x-1/2 bottom-[-30%] w-[70%] h-[70%] rounded-full bg-white opacity-70 blur-[60px]" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 h-1/3 opacity-[0.18]" aria-hidden="true"
              style={{ backgroundImage: "radial-gradient(#1775E8 0.8px, transparent 0.8px)", backgroundSize: "14px 14px", maskImage: "linear-gradient(0deg,#000,transparent)" }} />
        <div className="relative px-4">
          <h2 className="font-semibold text-[34px] sm:text-[44px] lg:text-[48px] leading-[1.06] max-w-[700px] mx-auto">
            Built to compute, not to demo.<br />Open the console.
          </h2>
          <div className="mt-8"><BlackButton to="/app" size="lg">{ArrowDown}Open the live console</BlackButton></div>
          <p className="mt-4 text-[12px] text-[#3D4247]/70">The free-tier backend sleeps when idle; the first request can take up to 30 s.</p>
        </div>
      </div>
    </section>
  );
}

const COLS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  { title: "Product", links: [{ label: "Overview", to: "/app" }, { label: "Fuel prediction", to: "/app/prediction" }, { label: "Fleet optimisation", to: "/app/optimization" }, { label: "CII compliance", to: "/app/compliance" }, { label: "Fleet register", to: "/app/fleet" }] },
  { title: "Method", links: [{ label: "Physics-informed model", to: "/app/prediction" }, { label: "QUBO annealing", to: "/app/optimization" }, { label: "Quantum PSO", to: "/app/optimization" }, { label: "Well-to-Wake", to: "/app/prediction" }] },
  { title: "Verification", links: [{ label: "Test suite", href: "https://github.com/LSUDOKO/NaviQ#verification" }, { label: "Solver ground truth", href: "https://github.com/LSUDOKO/NaviQ#verification" }, { label: "Data provenance", href: "https://github.com/LSUDOKO/NaviQ#data-provenance" }] },
  { title: "Project", links: [{ label: "About", to: "/app/about" }, { label: "API reference", href: "/docs" }, { label: "Source on GitHub", href: "https://github.com/LSUDOKO/NaviQ" }, { label: "SIH 2026 · SIH26138", href: "https://sih.gov.in" }] },
];

export function Footer() {
  return (
    <footer className="pt-20 sm:pt-24 pb-10">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div>
            <Mark />
            <p className="mt-3 text-[12.5px] leading-[1.6] text-[#70757A] max-w-[220px]">Quantum-inspired green fleet intelligence for IMO carbon-intensity compliance.</p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="text-[12.5px] font-semibold text-[#0B0D0F]">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.to
                      ? <Link to={l.to} className="text-[12.5px] text-[#70757A] hover:text-[#0B0D0F] transition-colors">{l.label}</Link>
                      : <a href={l.href} target="_blank" rel="noreferrer" className="text-[12.5px] text-[#70757A] hover:text-[#0B0D0F] transition-colors">{l.label}</a>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-[#E8E8E8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-[12px] text-[#9BA0A6]">© 2026 NAVIQ. Apache 2.0.</p>
          <a href="https://github.com/LSUDOKO/NaviQ" target="_blank" rel="noreferrer" aria-label="GitHub" className="text-[#70757A] hover:text-[#0B0D0F] transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 8.4 22.9c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" /></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
