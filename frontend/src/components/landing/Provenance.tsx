import { LeadCopy, SectionHead, Wrap } from "./ui";

/* Light diagrams: each is the kind of evidence the card is about. */
function Docs() {
  return (
    <ul className="space-y-1.5">
      {["MEPC.353(78) reference lines", "MEPC.354(78) rating bands", "MEPC.364(79) carbon factors", "MEPC.1/Circ.905 LCA"].map((d) => (
        <li key={d} className="flex items-center gap-2 text-[11px] text-[#4A4F55] bg-white rounded-[8px] border border-[#EDEDED] px-2.5 py-1.5">
          <span className="w-3 h-3.5 rounded-[2px] border border-[#1775E8] bg-[#EAF3FF] shrink-0" aria-hidden="true" />{d}
        </li>
      ))}
    </ul>
  );
}
function Intensities() {
  const rows = [["VLSFO", 91.7], ["LNG", 76.1], ["e-Methanol", 3.2], ["Green NH₃", 0.9]] as const;
  return (
    <div className="space-y-2">
      {rows.map(([n, v]) => (
        <div key={n} className="text-[11px]">
          <div className="flex justify-between text-[#4A4F55]"><span>{n}</span><span className="tabular">{v} gCO₂e/MJ</span></div>
          <div className="h-1.5 rounded-full bg-white overflow-hidden mt-1"><span className="block h-full bg-[#1775E8] rounded-full" style={{ width: `${v}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
function SeaLane() {
  return (
    <svg viewBox="0 0 220 110" className="w-full h-auto" aria-hidden="true">
      <rect width="220" height="110" rx="10" fill="#fff" />
      <path d="M0 62 C40 40 70 90 110 70 S190 30 220 44 V110 H0Z" fill="#EAF3FF" />
      <path d="M22 78 C60 66 90 58 118 52 S170 34 198 30" fill="none" stroke="#1775E8" strokeWidth="2" strokeDasharray="4 3" />
      {[[22, 78], [118, 52], [198, 30]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.5" fill="#0B0D0F" />)}
      <text x="26" y="94" fontSize="9" fill="#70757A">Mundra</text>
      <text x="164" y="24" fontSize="9" fill="#70757A">Rotterdam</text>
      <text x="100" y="66" fontSize="9" fill="#70757A">Suez</text>
    </svg>
  );
}
function Tests() {
  return (
    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
      {[["physics", 24], ["solvers", 21], ["CII rules", 19], ["API", 19]].map(([n, c]) => (
        <div key={n} className="flex items-center justify-between bg-white rounded-[8px] border border-[#EDEDED] px-2.5 py-1.5 text-[#4A4F55]">
          <span>{n}</span><span className="text-[#15803D] font-medium">{c} ✓</span>
        </div>
      ))}
      <p className="col-span-2 text-[10.5px] text-[#70757A] pt-1">83 passing in 4.5 s</p>
    </div>
  );
}

const CARDS = [
  { art: <Docs />, lead: "Rules from the regulator.", copy: "Reference lines, rating bands and reduction factors are taken from the IMO resolutions, not approximated." },
  { art: <Intensities />, lead: "Fuel intensities from FuelEU and the IPCC.", copy: "Well-to-tank values from (EU) 2023/1805 Annex II; warming potentials from AR6." },
  { art: <SeaLane />, lead: "Routes that follow real sea lanes.", copy: "Leg distances come from waypoint geodesics, so the map and the fuel figures reconcile." },
  { art: <Tests />, lead: "No mocks, no hard-coded results.", copy: "Every algorithm computes. The verification in the README reproduces from a clean checkout." },
];

export function Provenance() {
  return (
    <section className="mt-24 sm:mt-32 py-20 sm:py-24 bg-[#FAFAFA] border-y border-[#EFEFEF]">
      <Wrap>
        <SectionHead eyebrow="Data provenance" eyebrowTo="/app/about"
          title="Nothing invented for the demo."
          sub="Everything the model, the solvers and the rating logic depend on traces to a published source." />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((c) => (
            <article key={c.lead}>
              <div className="rounded-[14px] bg-[#F0F1F3] p-4 min-h-[180px] flex flex-col justify-center">{c.art}</div>
              <LeadCopy lead={c.lead} className="mt-4 text-[13px]">{c.copy}</LeadCopy>
            </article>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
