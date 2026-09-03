/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060F1C", 900: "#0A1628", 850: "#0D1D33",
          800: "#12263F", 700: "#1E3A5F", 600: "#2A4E7A",
        },
        teal: { DEFAULT: "#00BFA6", bright: "#2DE3C8", dim: "#00806F" },
        amber: { DEFAULT: "#F59E0B", dim: "#B45309" },
        cii: { a: "#22C55E", b: "#84CC16", c: "#F59E0B", d: "#F97316", e: "#EF4444" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        panel: "inset 0 1px 0 0 rgba(45,227,200,0.06)",
        glow: "0 0 24px -8px rgba(0,191,166,0.45)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};
