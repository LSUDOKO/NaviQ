import { Eyebrow, LeadCopy, Wrap } from "./ui";

/* Small diagram: funnel vs lifecycle for grey ammonia against VLSFO = 100. */
function AmmoniaBars() {
  const rows = [
    { name: "VLSFO", funnel: 100, total: 100 },
    { name: "Grey NH₃", funnel: 9, total: 151 },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.name} className="text-[11px]">
          <div className="flex justify-between text-[#4A4F55] mb-1"><span className="font-medium">{r.name}</span><span className="tabular">{r.funnel} · {r.total}</span></div>
          <div className="h-2 rounded-full bg-white/70 overflow-hidden mb-1"><span className="block h-full rounded-full bg-[#F97316]" style={{ width: `${r.funnel / 1.6}%` }} /></div>
          <div className="h-2 rounded-full bg-white/70 overflow-hidden"><span className="block h-full rounded-full bg-[#0B0D0F]" style={{ width: `${r.total / 1.6}%` }} /></div>
        </div>
      ))}
      <p className="text-[10.5px] text-[#70757A] pt-1">orange funnel · black well-to-wake</p>
    </div>
  );
}

/* Small diagram: shore power decision against grid intensity. */
function ShoreDecision() {
  const grids = [
    { port: "Rotterdam", g: 268, on: true },
    { port: "Singapore", g: 408, on: true },
    { port: "Mundra", g: 632, on: false },
  ];
  return (
    <div className="space-y-2">
      {grids.map((p) => (
        <div key={p.port} className="flex items-center gap-2 text-[11px] rounded-[10px] bg-white/70 px-3 py-2">
          <span className="w-16 font-medium text-[#0B0D0F]">{p.port}</span>
          <span className="flex-1 tabular text-[#4A4F55]">{p.g} gCO₂/kWh</span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${p.on ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>{p.on ? "connect" : "decline"}</span>
        </div>
      ))}
    </div>
  );
}

/* Small diagram: methane slip layered on LNG combustion. */
function SlipStack() {
  return (
    <div>
      <div className="flex h-[52px] rounded-[10px] overflow-hidden text-[10.5px] font-medium">
        <span className="flex items-center justify-center bg-[#0E7490] text-white" style={{ width: "62%" }}>CO₂ at the funnel</span>
        <span className="flex items-center justify-center bg-[#22D3EE] text-[#083344]" style={{ width: "18%" }}>upstream</span>
        <span className="flex items-center justify-center bg-[#FDE68A] text-[#78350F]" style={{ width: "20%" }}>CH₄ slip</span>
      </div>
      <p className="mt-2 text-[10.5px] text-[#70757A]">Unburnt methane counted at IPCC AR6 GWP100 = 29.8×CO₂</p>
    </div>
  );
}

const CARDS = [
  { bg: "#FEF3C7", art: <AmmoniaBars />, lead: "Grey ammonia gets caught.", copy: "It burns 91% cleaner at the funnel and emits 51% more overall. Tank-to-wake reporting would recommend it; NAVIQ separates upstream from combustion and flags the gap." },
  { bg: "#DDF8FF", art: <ShoreDecision />, lead: "Shore power is decided, not assumed.", copy: "Plugging in is a real binary variable in the QUBO. Against a coal-heavy grid the optimiser declines to connect, because the auxiliary engine is the cleaner choice there." },
  { bg: "#ECFCCB", art: <SlipStack />, lead: "Slip is on the ledger.", copy: "LNG's unburnt methane is priced at its hundred-year warming potential, so a low-carbon fuel on paper is scored on what actually leaves the ship." },
];

export function Lifecycle() {
  return (
    <section className="pt-28 sm:pt-36">
      <Wrap>
        <Eyebrow to="/app/prediction">Well-to-Wake accounting</Eyebrow>
        <h2 className="mt-4 font-semibold text-[34px] sm:text-[44px] leading-[1.06] max-w-[760px]">Fuels compared across their whole lifecycle.</h2>
        <div className="mt-5 max-w-[640px] space-y-3 text-[15px] leading-[1.65] text-[#70757A]">
          <p>Every alternative fuel is costed on the same voyage: mass from energy content and engine efficiency, then upstream production added to what leaves the funnel.</p>
          <p>Intensities follow IMO MEPC.364(79) and FuelEU Maritime Annex II, so the comparison holds up in an audit as well as on a slide.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CARDS.map((c) => (
            <article key={c.lead}>
              <div className="rounded-[16px] p-5 min-h-[200px] flex flex-col justify-end" style={{ background: c.bg }}>{c.art}</div>
              <LeadCopy lead={c.lead} className="mt-5 pr-2">{c.copy}</LeadCopy>
            </article>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
