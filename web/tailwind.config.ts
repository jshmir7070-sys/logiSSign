import type { Config } from "tailwindcss";

// =============================================================
// Precision Velocity Design System — Tailwind Tokens
// Source of truth: stitch/stitch_core/DESIGN.md
// Matches: mobile/constants/theme.ts
// =============================================================

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        "primary": "#004ac6",
        "primary-container": "#2563eb",
        "on-primary": "#ffffff",
        "on-primary-container": "#eeefff",
        "on-primary-fixed": "#00174b",
        "on-primary-fixed-variant": "#003ea8",
        "primary-fixed": "#dbe1ff",
        "primary-fixed-dim": "#b4c5ff",
        "inverse-primary": "#b4c5ff",

        // Secondary
        "secondary": "#565e74",
        "secondary-container": "#dae2fd",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#5c647a",
        "on-secondary-fixed": "#131b2e",
        "on-secondary-fixed-variant": "#3f465c",
        "secondary-fixed": "#dae2fd",
        "secondary-fixed-dim": "#bec6e0",

        // Tertiary (success)
        "tertiary": "#006242",
        "tertiary-container": "#007d55",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#bdffdb",
        "on-tertiary-fixed": "#002113",
        "on-tertiary-fixed-variant": "#005236",
        "tertiary-fixed": "#6ffbbe",
        "tertiary-fixed-dim": "#4edea3",

        // Error
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Surfaces (tonal layering — DESIGN.md §2)
        "surface": "#f7f9fb",
        "surface-dim": "#d8dadc",
        "surface-bright": "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "surface-variant": "#e0e3e5",
        "surface-tint": "#0053db",
        "on-surface": "#191c1e",
        "on-surface-variant": "#434655",
        "background": "#f7f9fb",
        "on-background": "#191c1e",

        // Outlines
        "outline": "#737686",
        "outline-variant": "#c3c6d7",

        // Inverse
        "inverse-surface": "#2d3133",
        "inverse-on-surface": "#eff1f3",

        // Sidebar (The Control Tower — DESIGN.md §5)
        "sidebar": "#0F172A",
      },
      fontFamily: {
        // Dual-font strategy (DESIGN.md §3)
        "headline": ["Pretendard", "sans-serif"],
        "body": ["Pretendard", "sans-serif"],
        "label": ["Pretendard", "sans-serif"],
        "korean": ["Pretendard", "sans-serif"],
        "data": ["Inter", "sans-serif"],
      },
      fontSize: {
        // Maps to mobile typography scale
        "display-lg": ["1.75rem", { lineHeight: "2.25rem", fontWeight: "700" }],
        "display-md": ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        "display-sm": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        "title-lg": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        "title-md": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "title-sm": ["1rem", { lineHeight: "1.375rem", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5rem", fontWeight: "400" }],
        "body-md": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "400" }],
        "body-sm": ["0.75rem", { lineHeight: "1rem", fontWeight: "400" }],
        "label-lg": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "600", letterSpacing: "0.02em" }],
        "label-md": ["0.75rem", { lineHeight: "1rem", fontWeight: "500", letterSpacing: "0.02em" }],
        "label-sm": ["0.6875rem", { lineHeight: "0.875rem", fontWeight: "500", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "md": "0.5rem",    // 8px — buttons
        "lg": "1rem",      // 16px — cards lg
        "xl": "1.5rem",    // 24px — cards xl (KPI cards)
        "2xl": "1.5rem",   // alias for xl
        "full": "9999px",  // badges
      },
      boxShadow: {
        // Sidebar Navy tinted — never pure black (DESIGN.md §4)
        "sm": "0 1px 2px rgba(15, 23, 42, 0.04)",
        "card": "0 4px 16px rgba(15, 23, 42, 0.06)",
        "ambient": "0 8px 32px rgba(15, 23, 42, 0.08)",
        "float": "0 12px 48px rgba(15, 23, 42, 0.12)",
      },
      backgroundImage: {
        // Power Gradient — primary CTAs and sparklines (DESIGN.md §2)
        "power-gradient": "linear-gradient(135deg, #004ac6, #2563eb)",
      },
      backdropBlur: {
        // Glass effect for floating headers (DESIGN.md §2)
        "glass": "20px",
      },
      spacing: {
        // Extra spacing tokens matching mobile
        "4.5": "1.125rem", // 18px
        "13": "3.25rem",   // 52px
      },
    },
  },
  plugins: [],
};
export default config;
