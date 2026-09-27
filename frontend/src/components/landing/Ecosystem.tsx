import { SectionHead, Wrap } from "./ui";

/*
  Everything the optimiser reasons over: fuels, standards, data feeds and the
  physics underneath. Colour marks the kind of thing each tile is.
*/
type Tile = { mark: string; name: string; bg: string; fg: string };

const FUELS: Tile[] = [
  { mark: "HFO", name: "Heavy fuel oil", bg: "#3F3F46", fg: "#fff" },
  { mark: "VLS", name: "VLSFO", bg: "#52525B", fg: "#fff" },
  { mark: "MGO", name: "Marine gas oil", bg: "#71717A", fg: "#fff" },
  { mark: "LNG", name: "LNG", bg: "#DDF8FF", fg: "#0E7490" },
  { mark: "LPG", name: "LPG", bg: "#E0F2FE", fg: "#0369A1" },
  { mark: "MeOH", name: "Methanol", bg: "#EDE9FE", fg: "#6D28D9" },
  { mark: "eMeOH", name: "e-Methanol", bg: "#F3E8FF", fg: "#7E22CE" },
  { mark: "NH₃", name: "Grey ammonia", bg: "#FEF3C7", fg: "#B45309" },
  { mark: "NH₃", name: "Green ammonia", bg: "#DCFCE7", fg: "#15803D" },
  { mark: "H₂", name: "Green hydrogen", bg: "#CFF5FB", fg: "#0891B2" },
  { mark: "BIO", name: "Biodiesel", bg: "#ECFCCB", fg: "#4D7C0F" },
  { mark: "⏚", name: "Shore power", bg: "#FFE4E6", fg: "#BE123C" },
];
const REFS: Tile[] = [
  { mark: "353", name: "MEPC.353(78)", bg: "#EAF3FF", fg: "#1775E8" },
  { mark: "354", name: "MEPC.354(78)", bg: "#EAF3FF", fg: "#1775E8" },
  { mark: "364", name: "MEPC.364(79)", bg: "#EAF3FF", fg: "#1775E8" },
  { mark: "EU", name: "FuelEU Maritime", bg: "#FEF9C3", fg: "#A16207" },
  { mark: "AR6", name: "IPCC GWP100", bg: "#DCFCE7", fg: "#166534" },
  { mark: "GFS", name: "NOAA weather", bg: "#F1F5F9", fg: "#334155" },
  { mark: "CMS", name: "Copernicus CMEMS", bg: "#F1F5F9", fg: "#334155" },
  { mark: "H–M", name: "Holtrop–Mennen", bg: "#FCE7F3", fg: "#BE185D" },
  { mark: "ITTC", name: "ITTC-1957 line", bg: "#FCE7F3", fg: "#BE185D" },
  { mark: "AFIR", name: "EU AFIR Art. 9", bg: "#FEF9C3", fg: "#A16207" },
  { mark: "IAPH", name: "Port sustainability", bg: "#FFEDD5", fg: "#C2410C" },
  { mark: "SEEMP", name: "Corrective plans", bg: "#EAF3FF", fg: "#1775E8" },
];

function Row({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {tiles.map((t) => (
        <li key={t.name} title={t.name} className="flex flex-col items-center gap-2 w-[72px] sm:w-[84px]">
          <span className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] rounded-[18px] flex items-center justify-center text-[13px] sm:text-[14px] font-bold tracking-[-0.01em] shadow-[0_1px_2px_rgba(11,13,15,0.06)]"
                style={{ background: t.bg, color: t.fg }}>
            {t.mark}
          </span>
          <span className="text-[11px] text-[#70757A] text-center leading-tight">{t.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function Ecosystem() {
  return (
    <section className="pt-24 sm:pt-32">
      <Wrap>
        <SectionHead eyebrow="Every input the plan depends on" eyebrowTo="/app/prediction"
          title={<>Every decision a voyage makes, made on evidence.</>} />
      </Wrap>
      <div className="fade-bottom mt-14 space-y-8 pb-10">
        <Row tiles={FUELS} />
        <Row tiles={REFS} />
      </div>
    </section>
  );
}
