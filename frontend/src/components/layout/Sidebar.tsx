import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  hint: string;
  icon: ReactElement;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const NAV: NavItem[] = [
  {
    to: "/",
    label: "Overview",
    hint: "Fleet position and carbon intensity",
    icon: (
      <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" {...stroke}>
        <path d="M2.5 15.5h15M4 15.5V9m4 6.5V5.5m4 10v-8m4 8V3.5" />
      </svg>
    ),
  },
  {
    to: "/prediction",
    label: "Prediction",
    hint: "Fuel burn and fuel choice",
    icon: (
      <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" {...stroke}>
        <path d="M2.5 13.5c2-5 4-7 7.5-7s5.5 2 7.5 7" />
        <circle cx="10" cy="13.5" r="1.6" />
      </svg>
    ),
  },
  {
    to: "/optimization",
    label: "Optimisation",
    hint: "Deployment, speed and fuel plans",
    icon: (
      <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" {...stroke}>
        <circle cx="5" cy="6" r="2" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="10" cy="15" r="2" />
        <path d="M6.6 7.4 8.8 13m4.6-5.6L11.2 13M7 6h6" />
      </svg>
    ),
  },
  {
    to: "/compliance",
    label: "Compliance",
    hint: "IMO carbon intensity rating",
    icon: (
      <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" {...stroke}>
        <path d="M10 2.5 16.5 5v5c0 4-2.8 6.4-6.5 7.5C6.3 16.4 3.5 14 3.5 10V5z" />
        <path d="M7.5 10l1.8 1.8L13 8" />
      </svg>
    ),
  },
  {
    to: "/fleet",
    label: "Fleet",
    hint: "Vessels and particulars",
    icon: (
      <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" {...stroke}>
        <path d="M2.5 13.5h15l-1.6 3.5H4.1zM4.5 13.5V8h11v5.5M10 8V4.5M7 4.5h6" />
      </svg>
    ),
  },
  {
    to: "/about",
    label: "About",
    hint: "Method and references",
    icon: (
      <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]" {...stroke}>
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 9v4.5M10 6.6v.5" />
      </svg>
    ),
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="h-full flex flex-col bg-ink-900 border-r border-ink-line" aria-label="Main">
      <div className="px-5 py-5 border-b border-ink-line">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-lg font-bold tracking-[0.2em] text-txt-primary leading-none">
            NAVIQ
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-slow"
            aria-hidden="true"
          />
        </div>
        <p className="text-2xs text-txt-quiet mt-2 leading-snug">
          Green fleet intelligence
        </p>
      </div>

      <ul className="flex-1 py-2.5 overflow-y-auto">
        {NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "group flex items-start gap-3 px-5 py-2.5 border-l-2 transition-colors duration-150",
                  isActive
                    ? "border-signal bg-ink-850 text-txt-primary"
                    : "border-transparent text-txt-secondary hover:text-txt-primary hover:bg-ink-850/60",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? "text-signal mt-px" : "text-txt-quiet mt-px"}>
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-tight">{item.label}</span>
                    <span className="block text-2xs text-txt-quiet leading-snug mt-1">
                      {item.hint}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="px-5 py-4 border-t border-ink-line">
        <p className="text-2xs text-txt-quiet leading-relaxed">
          Smart India Hackathon 2026
          <br />
          Problem statement SIH26138
        </p>
      </div>
    </nav>
  );
}

export default Sidebar;
