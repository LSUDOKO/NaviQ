import { useState } from "react";
import { Link } from "react-router-dom";
import { Wrap } from "./ui";

/*
  Every figure here is produced by running the repository code (see README
  "Verification"). Bars are proportional within a tab; the unit differs per tab.
*/
type Row = { label: string; value: string; pct: number; ours?: boolean };
type Bench = { key: string; name: string; unit: string; rows: Row[] };

const BENCHES: Bench[] = [
  {
    key: "prediction", name: "Fuel prediction", unit: "Validation error, MAPE — shorter is better",
    rows: [
      { label: "NAVIQ physics-informed BiLSTM", value: "5.11%", pct: 5.11 / 14.15, ours: true },
      { label: "Naive cubic speed law (v³)", value: "10.80%", pct: 10.8 / 14.15 },
      { label: "Network before training", value: "14.15%", pct: 1 },
    ],
  },
  {
    key: "qubo", name: "QUBO annealing", unit: "Share of the proven global optimum reached, per trial — checked against all 16,384 states",
    rows: [1, 2, 3, 4, 5].map((n) => ({ label: `Trial ${n} · 14 binary variables`, value: "100%", pct: 1, ours: true })),
  },
  {
    key: "qpso", name: "Quantum PSO", unit: "Orders of magnitude from the known minimum — longer is closer",
    rows: [
      { label: "Sphere, 8-D", value: "1.3 × 10⁻²²", pct: 21.9 / 24, ours: true },
      { label: "Rastrigin, 5-D (traps velocity swarms)", value: "3.0 × 10⁻⁴", pct: 3.5 / 24, ours: true },
    ],
  },
];

export function Benchmarks() {
  const [active, setActive] = useState(BENCHES[0].key);
  const bench = BENCHES.find((b) => b.key === active) ?? BENCHES[0];

  return (
    <section className="pt-28 sm:pt-36">
      <Wrap width="max-w-[720px]">
        <h2 className="font-semibold text-[28px] sm:text-[32px] leading-[1.1]">Verified against ground truth.</h2>
        <p className="mt-4 text-[15px] leading-[1.65] text-[#70757A]">
          The QUBO solver is checked against exhaustive search, so its optimum is proven rather than
          estimated. The prediction model is scored on held-out voyages, and the swarm on published
          benchmarks. Every number below is reproducible from a clean checkout.{" "}
          <Link to="/app/about" className="text-signal font-medium hover:opacity-80">See the method</Link>
        </p>

        <div className="mt-10 rounded-[16px] border border-[#E8E8E8] bg-white p-5 sm:p-7" key={bench.key}>
          <ol className="space-y-4">
            {bench.rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[240px_minmax(0,1fr)_72px] items-center gap-x-4 gap-y-1.5">
                <span className={`text-[13px] leading-tight truncate ${r.ours ? "font-semibold text-[#0B0D0F]" : "text-[#4A4F55]"}`}>{r.label}</span>
                <span className="text-[13px] font-medium tabular text-right sm:order-3 text-[#0B0D0F]">{r.value}</span>
                <span className="col-span-2 sm:col-span-1 sm:order-2 h-[10px] rounded-full bg-[#F0F1F3] overflow-hidden">
                  <span className={`bar-fill block h-full rounded-full ${r.ours ? "bg-signal" : "bg-[#C9CDD3]"}`} style={{ width: `${Math.round(r.pct * 100)}%` }} />
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[12px] text-[#9BA0A6]">{bench.unit}</p>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="seg" role="tablist" aria-label="Benchmark">
            {BENCHES.map((b) => (
              <button key={b.key} type="button" role="tab" aria-selected={b.key === active} aria-pressed={b.key === active} onClick={() => setActive(b.key)}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </Wrap>
    </section>
  );
}
