import { Link } from "react-router-dom";
import { Wrap } from "./ui";

const STAGES = [
  { name: "QUBO annealing", detail: "vessel, route, fuel, shore power", done: true },
  { name: "Quantum PSO", detail: "speed on every leg, ETA-bounded", done: true },
  { name: "Five objectives", detail: "cost, lifecycle GHG, delay, risk", done: true },
  { name: "Non-dominated sort", detail: "9 plans survive", done: true },
];

export function Telemetry() {
  return (
    <section className="pt-28 sm:pt-36">
      <Wrap width="max-w-[720px]">
        <h2 className="font-semibold text-[28px] sm:text-[32px] leading-[1.1]">Solvers you can watch working.</h2>
        <p className="mt-4 text-[15px] leading-[1.65] text-[#70757A]">
          Temperature and transverse field decay together across successive anneals, tunnelling
          events are counted as they happen, and swarm diversity collapses as the particles converge.
          The curves stream over a WebSocket from the running solver and stay on screen after the
          run. They cannot be produced by a mocked backend.{" "}
          <Link to="/app/optimization" className="text-signal font-medium hover:opacity-80">Run one</Link>
        </p>
      </Wrap>

      <Wrap className="mt-14">
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
          {/* the operator's request */}
          <div className="rounded-[16px] border border-[#E8E8E8] bg-white p-5 shadow-card lg:mt-10">
            <p className="text-[11px] font-medium text-[#9BA0A6] mb-2">Optimisation request</p>
            <p className="text-[15px] font-medium text-[#0B0D0F] leading-[1.45]">
              Deploy five vessels across four routes this quarter. Minimise fuel and lifecycle
              emissions; keep every plan CII-compliant.
            </p>
            <ol className="mt-5 space-y-2.5">
              {STAGES.map((s) => (
                <li key={s.name} className="flex items-start gap-2.5 text-[12.5px]">
                  <span className="mt-[3px] w-4 h-4 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6 2.5 2.5 4.5-5" /></svg>
                  </span>
                  <span><span className="font-medium text-[#0B0D0F]">{s.name}</span> <span className="text-[#70757A]">— {s.detail}</span></span>
                </li>
              ))}
            </ol>
          </div>

          {/* layered solver panels */}
          <div className="relative">
            <figure className="browser-frame">
              <img src="/landing/ui-solving.png" alt="Live solver telemetry: annealing schedule, tunnelling count and swarm diversity" loading="lazy" />
            </figure>
            <div className="hidden sm:block absolute -bottom-6 -left-6 lg:-left-10 w-[260px] rounded-[14px] bg-white border border-[#E8E8E8] shadow-pop p-4">
              <p className="text-[11px] font-medium text-[#9BA0A6]">Result</p>
              <p className="mt-1 text-[13px] text-[#0B0D0F] font-medium">9 Pareto-optimal plans</p>
              <p className="mt-1 text-[12px] text-[#70757A] leading-[1.5]">83% cost spread, 74% emissions spread, every plan compliant. Solved on a laptop CPU.</p>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
