import { LeadCopy, Wrap } from "./ui";

/*
  Three product surfaces, each shown by a crop of the real page rather than an
  illustration. The crop is positioned so the relevant chart is what shows.
*/
const CARDS = [
  {
    src: "/landing/ui-prediction.png", pos: "72% 18%", alt: "Fuel prediction with a 95% interval and resistance breakdown",
    lead: "Predict fuel burn with its uncertainty.", copy: "A BiLSTM with time-aware attention, trained under a physics loss so predictions stay physical on weather it never saw. 5.11% error, with a 95% interval on every figure.",
  },
  {
    src: "/landing/ui-optimization.png", pos: "78% 62%", alt: "Pareto front of optimised fleet plans",
    lead: "Optimise which ship, which fuel, which speed.", copy: "QUBO annealing decides the discrete deployment, quantum PSO the continuous speeds. Nine Pareto-optimal plans from a laptop CPU, every one compliant.",
  },
  {
    src: "/landing/ui-compliance.png", pos: "62% 42%", alt: "Carbon intensity rails against MEPC boundaries",
    lead: "Comply with the rating that tightens every year.", copy: "Attained intensity against the real MEPC lines, and the projected drift toward D and E when nothing about the ship changes. The margin is the visible quantity.",
  },
];

export function Capabilities() {
  return (
    <section className="pt-16 sm:pt-20">
      <Wrap>
        <p className="mx-auto max-w-[640px] text-center text-[15px] sm:text-[16px] leading-[1.65] text-[#3D4247]">
          Fuel-prediction platforms, voyage optimisers and CII dashboards each answer one question.
          Answered independently, the answers conflict. NAVIQ solves prediction, deployment and
          compliance as one problem, so the plan that leaves the berth is the one that stays legal.
        </p>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {CARDS.map((c) => (
            <article key={c.src} className="group">
              <div className="rounded-[16px] bg-[#F4F5F7] border border-[#EDEDED] overflow-hidden aspect-[4/3] transition-shadow group-hover:shadow-pop">
                <img src={c.src} alt={c.alt} loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: c.pos, transform: "scale(1.6)", transformOrigin: c.pos }} />
              </div>
              <LeadCopy lead={c.lead} className="mt-5 pr-2">{c.copy}</LeadCopy>
            </article>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
