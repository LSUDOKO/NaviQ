/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces run darkest to lightest; depth is carried by value rather
        // than by stacked shadows.
        ink: {
          950: "#050B14",
          900: "#08111F",
          850: "#0C1829",
          800: "#112336",
          700: "#1B3A56",
          line: "#16293F",
          bright: "#1F3B57",
        },
        signal: {
          DEFAULT: "#00BFA6",
          bright: "#35E8CD",
          dim: "#00806F",
        },
        warn: { DEFAULT: "#F59E0B", dim: "#B45309" },
        cii: {
          a: "#22C55E", b: "#84CC16", c: "#F59E0B", d: "#F97316", e: "#EF4444",
        },
        txt: {
          primary: "#E8EEF5",
          secondary: "#9BADC2",
          tertiary: "#61748C",
          quiet: "#3E5169",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"],
      },
      // A modular scale at ~1.25 rather than arbitrary pixel values.
      fontSize: {
        "2xs": ["11px", { lineHeight: "1.45" }],
        xs: ["11.5px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["15px", { lineHeight: "1.5" }],
        lg: ["19px", { lineHeight: "1.35" }],
        xl: ["24px", { lineHeight: "1.2" }],
        "2xl": ["34px", { lineHeight: "1.08" }],
        "3xl": ["46px", { lineHeight: "1" }],
      },
      letterSpacing: {
        tightest: "-0.035em",
        tighter: "-0.025em",
        tight: "-0.011em",
      },
      animation: {
        "pulse-slow": "pulse 3.2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};
