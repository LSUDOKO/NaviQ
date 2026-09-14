import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Step definitions ──────────────────────────────────────────────────── */
interface TourStep {
  title: string;
  content: string;
  targetId: string | null;
  /** Where to place the tooltip card relative to the target. */
  side: "center" | "right" | "bottom";
  icon: string; // emoji or text shorthand for the step icon
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to NAVIQ",
    content:
      "Quantum-Inspired Green Fleet Intelligence. Let's take a 2-minute tour so you get the most out of the platform.",
    targetId: null,
    side: "center",
    icon: "⚓",
  },
  {
    title: "Navigation",
    content:
      "The sidebar is your primary control panel. Every module — from the live dashboard to the quantum solvers — is one click away.",
    targetId: "tour-sidebar",
    side: "right",
    icon: "🗂",
  },
  {
    title: "Fleet Overview",
    content:
      "Your command centre. Live carbon-intensity KPIs, annual emissions by vessel, fleet compliance gauge, and a real-time position map.",
    targetId: "tour-dashboard-main",
    side: "center",
    icon: "📊",
  },
  {
    title: "Fuel Prediction",
    content:
      "Physics-informed BiLSTM forecasting. Get a fuel-burn estimate with a 95 % uncertainty band, resistance decomposition, and a full lifecycle fuel matrix.",
    targetId: "tour-nav-prediction",
    side: "right",
    icon: "⚡",
  },
  {
    title: "Fleet Optimisation",
    content:
      "Our core differentiator. A hybrid QUBO + QPSO solver decides vessel deployment, fuel, and speed simultaneously — with IMO CII compliance enforced as a hard constraint.",
    targetId: "tour-nav-optimisation",
    side: "right",
    icon: "🔬",
  },
  {
    title: "IMO CII Compliance",
    content:
      "Track each vessel's attained rating against the real MEPC.353 boundaries. The trajectory chart shows how the required line tightens year-on-year even if nothing changes operationally.",
    targetId: "tour-nav-compliance",
    side: "right",
    icon: "🛡",
  },
  {
    title: "Fleet Register",
    content:
      "Every vessel's technical particulars, the speed-against-fuel cubic curve, CII rail, and compatible alternative fuels — all in one place.",
    targetId: "tour-nav-fleet",
    side: "right",
    icon: "🚢",
  },
  {
    title: "Live Model Status",
    content:
      "NAVIQ never mocks results. This card shows whether the physics-informed neural model or the analytic Holtrop–Mennen predictor is active, along with its validation error.",
    targetId: "tour-telemetry",
    side: "right",
    icon: "🟢",
  },
  {
    title: "API & Docs",
    content:
      "Every calculation is available over a typed REST + WebSocket API. Open the interactive docs to explore the 37 endpoints or to integrate NAVIQ into your own systems.",
    targetId: "tour-nav-api-docs",
    side: "right",
    icon: "📄",
  },
  {
    title: "You're all set",
    content:
      "Start with the Dashboard for a fleet-wide view, then head to Optimisation to run your first quantum-inspired deployment plan.",
    targetId: null,
    side: "center",
    icon: "✅",
  },
];

const STORAGE_KEY = "naviq_onboarding_completed";
const PAD = 10; // spotlight padding in px
const TOOLTIP_W = 352;
const TOOLTIP_OFFSET = 20; // gap between spotlight edge and tooltip

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [entering, setEntering] = useState(false);
  const vp = useRef({ w: window.innerWidth, h: window.innerHeight });
  const nextRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  /* ── Init ── */
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => {
        setEntering(true);
        setVisible(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  /* ── Measure target element ── */
  const measure = useCallback(() => {
    if (!visible) return;
    vp.current = { w: window.innerWidth, h: window.innerHeight };
    const { targetId } = STEPS[step];
    if (!targetId) { setRect(null); return; }
    const el = document.getElementById(targetId);
    if (!el) { setRect(null); return; }
    // For sidebar steps, scroll the main content back to top so the map
    // panel isn't visible and doesn't bleed through the overlay.
    const isSidebarTarget = ["tour-sidebar", "tour-nav-dashboard", "tour-nav-prediction",
      "tour-nav-optimisation", "tour-nav-compliance", "tour-nav-fleet",
      "tour-nav-about", "tour-nav-api-docs", "tour-telemetry"].includes(STEPS[step].targetId ?? "");
    if (isSidebarTarget) {
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.scrollTop = 0;
    }
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => setRect(el.getBoundingClientRect()), 280);
  }, [step, visible]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /* ── Focus management ── */
  useEffect(() => {
    if (visible) setTimeout(() => nextRef.current?.focus(), 50);
  }, [step, visible]);

  /* ── Keyboard ── */
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") advance();
      if (e.key === "ArrowLeft") retreat();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step]);

  const finish = () => {
    setEntering(false);
    localStorage.setItem(STORAGE_KEY, "true");
    setTimeout(() => setVisible(false), 300);
  };

  const advance = () => {
    if (step < STEPS.length - 1) {
      if (step === 1) navigate("/"); // ensure dashboard is visible for step 3
      setStep((s) => s + 1);
    } else {
      finish();
    }
  };

  const retreat = () => step > 0 && setStep((s) => s - 1);

  if (!visible) return null;

  /* ── Spotlight geometry ── */
  const W = vp.current.w;
  const H = vp.current.h;
  const current = STEPS[step];
  const isCenter = current.side === "center" || !rect;

  let sx = 0, sy = 0, sw = 0, sh = 0;
  if (rect && !isCenter) {
    sx = Math.max(0, rect.left - PAD);
    sy = Math.max(0, rect.top - PAD);
    sw = Math.min(W - sx, rect.width + PAD * 2);
    sh = Math.min(H - sy, rect.height + PAD * 2);
  }

  const R = 12; // rounded corner radius for spotlight
  const maskPath =
    rect && sw > 0
      ? `M0 0 H${W} V${H} H0Z M${sx + R},${sy} h${sw - 2 * R} a${R},${R} 0 0 1 ${R},${R} v${sh - 2 * R} a${R},${R} 0 0 1 -${R},${R} h-${sw - 2 * R} a${R},${R} 0 0 1 -${R},-${R} v-${sh - 2 * R} a${R},${R} 0 0 1 ${R},-${R} Z`
      : `M0 0 H${W} V${H} H0Z`;

  /* ── Tooltip placement ── */
  const tipStyle: React.CSSProperties = { position: "absolute", width: TOOLTIP_W, maxWidth: `calc(100vw - 32px)` };

  if (isCenter) {
    tipStyle.top = "50%";
    tipStyle.left = "50%";
    tipStyle.transform = "translate(-50%, -50%)";
  } else if (rect) {
    const isMobile = W < 1024;
    if (isMobile) {
      // bottom-sheet on mobile
      tipStyle.bottom = 16;
      tipStyle.left = 16;
      tipStyle.right = 16;
      tipStyle.width = "auto";
    } else if (current.side === "right") {
      const rightEdge = sx + sw + TOOLTIP_OFFSET;
      const fitsRight = rightEdge + TOOLTIP_W < W;
      if (fitsRight) {
        tipStyle.left = rightEdge;
      } else {
        tipStyle.left = Math.max(16, sx - TOOLTIP_W - TOOLTIP_OFFSET);
      }
      // vertical: align with top of spotlight, clamp so it doesn't clip bottom
      const idealTop = sy;
      tipStyle.top = Math.min(Math.max(16, idealTop), H - 340);
    } else {
      // bottom
      const idealTop = sy + sh + TOOLTIP_OFFSET;
      tipStyle.top = Math.min(idealTop, H - 320);
      tipStyle.left = Math.min(Math.max(16, sx), W - TOOLTIP_W - 16);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 1000 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-title"
    >
      {/* ── Backdrop with spotlight cutout ── */}
      <svg
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
        }}
        preserveAspectRatio="none"
      >
        <path d={maskPath} fill="rgba(17,24,39,0.72)" fillRule="evenodd" />
      </svg>

      {/* Spotlight ring glow */}
      {rect && sw > 0 && (
        <div
          style={{
            position: "fixed",
            left: sx - 2,
            top: sy - 2,
            width: sw + 4,
            height: sh + 4,
            borderRadius: R + 2,
            border: "2px solid rgba(37,99,235,0.55)",
            boxShadow: "0 0 0 3px rgba(37,99,235,0.12)",
            pointerEvents: "none",
            transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      )}

      {/* ── Tooltip card ── */}
      <div
        style={{
          ...tipStyle,
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #E9EBF0",
          boxShadow: "0 20px 48px -12px rgba(16,24,40,0.22), 0 4px 12px -4px rgba(16,24,40,0.08)",
          overflow: "hidden",
          opacity: entering ? 1 : 0,
          transform: tipStyle.transform ?? (entering ? "translateY(0)" : "translateY(8px)"),
          transition: "opacity 280ms ease, transform 280ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Accent progress bar */}
        <div style={{ height: 3, background: "#E9EBF0" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #2563EB, #3B82F6)",
              transition: "width 300ms cubic-bezier(0.4,0,0.2,1)",
              borderRadius: "0 2px 2px 0",
            }}
          />
        </div>

        <div style={{ padding: "20px 22px 22px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Step icon chip */}
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#EEF3FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {current.icon}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#2563EB",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {step + 1} of {STEPS.length}
              </span>
            </div>
            <button
              onClick={finish}
              aria-label="Close tour"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#9CA3AF",
                cursor: "pointer",
                transition: "background 140ms, color 140ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#F8F9FB";
                (e.currentTarget as HTMLButtonElement).style.color = "#111827";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
              }}
            >
              <svg viewBox="0 0 20 20" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <h3
            id="ob-title"
            style={{
              fontSize: isFirst || isLast ? 22 : 17,
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
              margin: "0 0 8px",
            }}
          >
            {current.title}
          </h3>

          {/* Body */}
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "#4B5563",
              margin: 0,
            }}
          >
            {current.content}
          </p>

          {/* Step dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 18 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  borderRadius: 999,
                  border: "none",
                  background: i === step ? "#2563EB" : "#D9DDE5",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            ))}
          </div>

          {/* Footer actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid #E9EBF0",
            }}
          >
            <button
              onClick={finish}
              style={{
                background: "none",
                border: "none",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#9CA3AF",
                cursor: "pointer",
                padding: "4px 0",
                transition: "color 140ms",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6B7280")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF")}
            >
              {isLast ? "" : "Skip tour"}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              {step > 0 && (
                <button
                  onClick={retreat}
                  className="btn btn-ghost"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                >
                  Back
                </button>
              )}
              <button
                ref={nextRef}
                onClick={advance}
                className="btn btn-primary"
                style={{ padding: "6px 18px", fontSize: 13 }}
              >
                {isLast ? "Get started →" : isFirst ? "Start tour" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard hint — only shown on first step */}
      {isFirst && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "rgba(17,24,39,0.7)",
            borderRadius: 999,
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            Navigate with
          </span>
          {["←", "→", "Esc"].map((k) => (
            <kbd
              key={k}
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.9)",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              {k}
            </kbd>
          ))}
        </div>
      )}
    </div>
  );
}
