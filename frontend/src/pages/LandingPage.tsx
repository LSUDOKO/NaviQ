import { useEffect } from "react";
import { Benchmarks } from "../components/landing/Benchmarks";
import { Capabilities } from "../components/landing/Capabilities";
import { FinalCta, Footer } from "../components/landing/Closing";
import { Constraint } from "../components/landing/Constraint";
import { Ecosystem } from "../components/landing/Ecosystem";
import { Hero } from "../components/landing/Hero";
import { Lifecycle } from "../components/landing/Lifecycle";
import { Nav } from "../components/landing/Nav";
import { Provenance } from "../components/landing/Provenance";
import { Telemetry } from "../components/landing/Telemetry";
import { Eyebrow, LeadCopy, Wrap } from "../components/landing/ui";

function Introducing() {
  return (
    <section className="pt-8 sm:pt-12">
      <Wrap>
        <div className="grid gap-6 md:grid-cols-[1fr_2fr] lg:grid-cols-[1fr_1.6fr] max-w-[900px] mx-auto">
          <Eyebrow to="/app/about" className="md:pt-0.5">Introducing NAVIQ</Eyebrow>
          <div className="space-y-6">
            <LeadCopy lead="Operators face three questions at once, and today's tools answer them separately.">
              How much fuel will this voyage burn? Which ship, route, fuel and speed? Will we stay compliant?
              A prediction platform, an optimiser and a reporting dashboard each own one question, and their
              answers conflict.
            </LeadCopy>
            <LeadCopy lead="NAVIQ solves them as one problem.">
              A physics-informed model forecasts the burn with its uncertainty, hybrid quantum-inspired solvers
              choose the deployment and the speeds, and the carbon-intensity limit sits inside the search as a
              hard constraint — so the plan is compliant before the ship leaves the berth.
            </LeadCopy>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

export function LandingPage() {
  // The console shell pins the document to the viewport; the landing page scrolls as a document.
  useEffect(() => {
    document.title = "NAVIQ — Fleet planning where carbon limits are a constraint";
    return () => { document.title = "NAVIQ — Green Fleet Intelligence"; };
  }, []);

  return (
    <div className="landing h-full overflow-y-auto bg-white">
      <div className="relative">
        <Nav />
        <Hero />
        <Introducing />
        <Ecosystem />
        <Capabilities />
        <Benchmarks />
        <Telemetry />
        <Lifecycle />
        <Constraint />
        <Provenance />
        <FinalCta />
        <Footer />
      </div>
    </div>
  );
}

export default LandingPage;
