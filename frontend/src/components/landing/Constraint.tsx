import { WhiteButton, Wrap } from "./ui";

const BANDS = [
  { g: "A", c: "#16A34A" }, { g: "B", c: "#65A30D" }, { g: "C", c: "#D97706" }, { g: "D", c: "#EA580C" }, { g: "E", c: "#DC2626" },
];

/* Dark, glowing illustration: the chance constraint sitting on the rating rail. */
function ConstraintArt() {
  return (
    <div className="relative h-full min-h-[340px] rounded-[18px] overflow-hidden bg-[#0B0D0F] text-white">
      <span className="absolute w-[60%] h-[60%] left-[20%] top-[-20%] rounded-full bg-[#1775E8] opacity-40 blur-[80px]" aria-hidden="true" />
      <span className="absolute w-[40%] h-[40%] right-[-5%] bottom-[-10%] rounded-full bg-[#8DDEF0] opacity-25 blur-[70px]" aria-hidden="true" />

      <div className="relative h-full flex flex-col justify-between p-7 sm:p-9">
        <div>
          <p className="text-[11px] font-medium text-white/50">Inside the QUBO objective</p>
          <p className="mt-3 font-mono text-[26px] sm:text-[32px] tracking-tight">P(CII &gt; limit) ≤ ε</p>
          <p className="mt-2 text-[12.5px] text-white/60 max-w-[300px] leading-[1.55]">
            The penalty lives in the Q matrix. A deployment that would breach the limit has a higher energy than any that would not, so the annealer never settles on one.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
            <span>Attained ÷ required, 2026</span><span>ε = 0.05</span>
          </div>
          <div className="relative flex h-3 rounded-full overflow-hidden">
            {BANDS.map((b) => <span key={b.g} className="flex-1" style={{ background: b.c, opacity: 0.85 }} />)}
          </div>
          <div className="relative h-8 mt-1">
            <span className="absolute left-[38%] -translate-x-1/2 -top-[26px] flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.18),0_0_24px_rgba(141,222,240,0.9)]" />
            </span>
            <div className="flex text-[11px] font-medium">{BANDS.map((b) => <span key={b.g} className="flex-1 text-center text-white/70">{b.g}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Constraint() {
  return (
    <section className="pt-24 sm:pt-32">
      <Wrap>
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-stretch">
          <div className="flex flex-col justify-center">
            <h2 className="font-semibold text-[28px] sm:text-[32px] leading-[1.1]">
              Compliance is a constraint.<br /><span className="text-[#70757A]">Not something checked afterwards.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] text-[#70757A] max-w-[480px]">
              A ship rated C today drifts to D and then E without anything about it changing, because
              the required line moves every year. NAVIQ puts the rating limit inside the optimiser, so
              the plan it returns is legal for the year it will sail in.
            </p>
            <div className="mt-6"><WhiteButton to="/app/compliance">See the trajectory</WhiteButton></div>

            <dl className="mt-10 grid gap-6 sm:grid-cols-2 max-w-[520px]">
              <div>
                <dt className="text-[14px] font-semibold text-[#0B0D0F]">Infeasible plans never enter the search</dt>
                <dd className="mt-1 text-[13px] leading-[1.6] text-[#70757A]">No repair step, no post-hoc filter. The solver's energy landscape already excludes them.</dd>
              </div>
              <div>
                <dt className="text-[14px] font-semibold text-[#0B0D0F]">Uncertainty is a decision input</dt>
                <dd className="mt-1 text-[13px] leading-[1.6] text-[#70757A]">Plans are scored on E[F] + λ·σ(F). A route 5% better on average but wild in a storm loses to a steadier one.</dd>
              </div>
            </dl>
          </div>
          <ConstraintArt />
        </div>
      </Wrap>
    </section>
  );
}
