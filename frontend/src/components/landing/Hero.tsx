import { ArrowDown, BlackButton, BrowserFrame, Chevron } from "./ui";

export function Hero() {
  return (
    <section className="relative px-3 sm:px-4 pt-3 sm:pt-4">
      <div className="sky-panel relative overflow-hidden rounded-[22px] sm:rounded-[28px] pt-[130px] sm:pt-[150px] pb-0">
        {/* soft cloud forms */}
        <span className="cloud cloud-drift w-[38%] h-[120px] left-[-6%] top-[10%]" />
        <span className="cloud cloud-drift-slow w-[46%] h-[150px] right-[-10%] top-[6%]" />
        <span className="cloud cloud-drift w-[30%] h-[110px] left-[22%] top-[38%] opacity-60" />
        <span className="cloud cloud-drift-slow w-[40%] h-[140px] right-[12%] top-[44%] opacity-70" />

        <div className="relative mx-auto max-w-[1000px] px-4 sm:px-6 text-center">
          <a href="https://sih.gov.in" target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-white/60 border border-white/80 text-[12px] font-medium text-[#1775E8] hover:bg-white/80 transition-colors">
            Smart India Hackathon 2026 · SIH26138
            <Chevron className="w-3 h-3" />
          </a>

          <h1 className="mt-6 font-semibold text-[36px] sm:text-[46px] lg:text-[54px] leading-[1.05] max-w-[900px] mx-auto">
            Fleet planning where carbon limits are a constraint, not a report.
          </h1>

          <p className="mt-5 text-[15px] sm:text-[16px] leading-[1.6] text-[#3D4247] max-w-[560px] mx-auto">
            NAVIQ predicts fuel burn from physics and deep learning, deploys the fleet with
            quantum-inspired solvers, and guarantees every plan is IMO CII-compliant before
            the ship leaves the berth.
          </p>

          <div className="mt-8 flex justify-center">
            <BlackButton to="/app" size="lg">{ArrowDown}Open the live console</BlackButton>
          </div>
        </div>

        {/* product mockup overlapping the lower edge of the panel */}
        <div className="relative mx-auto max-w-[1120px] px-4 sm:px-8 mt-14 sm:mt-16 -mb-[12%] sm:-mb-[10%]">
          <BrowserFrame src="/landing/ui-dashboard.png" alt="NAVIQ overview: fleet carbon intensity, emissions by vessel, compliance gauge and fleet map" />
        </div>
      </div>
      <div className="h-[11vw] max-h-[130px]" aria-hidden="true" />
    </section>
  );
}
