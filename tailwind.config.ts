import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Contrast-checked against WCAG (a real Node script computing
        // relative luminance and contrast ratio, not eyeballed) before
        // use: -50 through -400 clear 4.5:1 against both steel-950 and
        // steel-900 for normal text; -500 clears 4.5:1 against steel-950
        // but only 3:1 (AA-large) against steel-900, so it's reserved for
        // UI elements/large text on the lighter surface, never body copy.
        steel: {
          50: "#f5f6f8",
          100: "#e8eaee",
          200: "#cdd1da",
          300: "#aeb4c2",
          400: "#8f96a8",
          500: "#717a8f",
          600: "#565e70",
          700: "#3c4250",
          800: "#242832",
          900: "#171a21",
          950: "#0c0e13",
        },
        // Primary interactive / brand.
        cobalt: {
          400: "#7a97ff",
          500: "#5578f0",
          600: "#3958cc",
        },
        // Critical / high-severity findings.
        crimson: {
          400: "#ff8a94",
          500: "#f0495c",
          600: "#c62840",
        },
        // Medium/low-severity findings, warnings.
        amber: {
          400: "#f7c463",
          500: "#e6a232",
          600: "#bd7d16",
        },
        // Clean scan, resolved finding, passing check.
        mint: {
          400: "#5fe0b8",
          500: "#2fc394",
          600: "#189670",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grid-fade": "radial-gradient(circle at 50% 0%, rgba(85,120,240,0.14), transparent 60%)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(85,120,240,0.18), 0 8px 40px -8px rgba(85,120,240,0.3)",
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 60px -20px rgba(0,0,0,0.7)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
