import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#E78023",
          "orange-hover": "#D26E17",
          "orange-light": "#F29441",
          "orange-muted": "rgba(231, 128, 35, 0.1)",
          navy: "#17458F",
          "navy-dark": "#0E2F66",
          "navy-light": "#205BB6",
          "navy-muted": "rgba(23, 69, 143, 0.08)",
          slate: "#3D406B",
          "slate-dark": "#2A2D4A",
          "slate-light": "#545785",
          // Premium Light Mode Palette
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          "surface-muted": "#F1F5F9",
          "surface-card": "#FFFFFF",
          border: "#E2E8F0",
          "border-navy": "rgba(23, 69, 143, 0.2)",
          "text-primary": "#0F172A",
          "text-navy": "#17458F",
          "text-secondary": "#475569",
          "text-muted": "#64748B",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Sora", "Manrope", "sans-serif"],
        display: ["Sora", "Manrope", "sans-serif"],
        sora: ["Sora", "sans-serif"],
        inter: ["Inter", "sans-serif"],
        manrope: ["Manrope", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
