/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light console. Token names are kept from the dark system so every
        // component inherits the new palette without a rename sweep:
        // ink-950 is the page canvas, ink-900 a card, ink-850 a hover state,
        // ink-800 a track, ink-line / ink-bright the two border weights.
        ink: {
          950: "#F4F5F7",
          900: "#FFFFFF",
          850: "#F8F9FB",
          800: "#EEF0F4",
          700: "#E3E6EC",
          line: "#E9EBF0",
          bright: "#D9DDE5",
        },
        signal: { DEFAULT: "#2563EB", bright: "#3B82F6", dim: "#1D4ED8", soft: "#EEF3FF" },
        warn: { DEFAULT: "#D97706", dim: "#B45309", soft: "#FEF3C7" },
        good: { DEFAULT: "#16A34A", soft: "#ECFDF3" },
        bad: { DEFAULT: "#DC2626", soft: "#FEF2F2" },
        cii: { a: "#16A34A", b: "#65A30D", c: "#D97706", d: "#EA580C", e: "#DC2626" },
        txt: { primary: "#111827", secondary: "#4B5563", tertiary: "#6B7280", quiet: "#9CA3AF" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.45" }],
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.55" }],
        lg: ["18px", { lineHeight: "1.35" }],
        xl: ["22px", { lineHeight: "1.2" }],
        "2xl": ["30px", { lineHeight: "1.1" }],
        "3xl": ["40px", { lineHeight: "1" }],
      },
      borderRadius: { card: "14px", chip: "8px" },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.03)",
        pop: "0 8px 24px -8px rgba(16,24,40,0.18)",
      },
    },
  },
  plugins: [],
};
