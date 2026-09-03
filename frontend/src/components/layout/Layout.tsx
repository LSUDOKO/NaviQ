import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Fleet overview",
    description: "Carbon intensity, emissions and position across the fleet",
  },
  "/prediction": {
    title: "Fuel prediction",
    description: "Physics-informed forecast with uncertainty, and a fuel comparison",
  },
  "/optimization": {
    title: "Fleet optimisation",
    description: "Hybrid quantum-inspired deployment, speed and fuel planning",
  },
  "/compliance": {
    title: "IMO CII compliance",
    description: "Attained rating, projected trajectory and corrective actions",
  },
  "/fleet": {
    title: "Fleet register",
    description: "Vessel particulars, performance curves and fuel options",
  },
  "/about": {
    title: "About NAVIQ",
    description: "Method, differentiators and references",
  },
};

export function Layout() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const meta = PAGE_META[location.pathname] ?? {
    title: "NAVIQ",
    description: "Quantum-inspired green fleet intelligence",
  };

  // A route change should never leave the mobile drawer covering the page.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="h-full flex">
      <aside className="hidden lg:block w-60 shrink-0">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-navy-950/80 z-40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-60 z-50">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <Header title={meta.title} description={meta.description} onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
