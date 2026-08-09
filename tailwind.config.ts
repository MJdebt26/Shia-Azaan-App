import type { Config } from "tailwindcss";

/**
 * Semantic tokens only.
 *
 * Every colour resolves to a CSS custom property defined in globals.css, so the
 * light theme and the live sky tint work without a second Tailwind palette and
 * without any class swapping at runtime.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        "bg-deep": "rgb(var(--c-bg-deep) / <alpha-value>)",
        surface: "rgb(var(--c-surface))",
        "surface-2": "rgb(var(--c-surface-2))",
        "surface-3": "rgb(var(--c-surface-3))",
        line: "rgb(var(--c-border))",
        "line-strong": "rgb(var(--c-border-strong))",
        ink: "rgb(var(--c-text) / <alpha-value>)",
        muted: "rgb(var(--c-text-muted) / <alpha-value>)",
        faint: "rgb(var(--c-text-faint) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-bright": "rgb(var(--c-accent-bright) / <alpha-value>)",
        "accent-deep": "rgb(var(--c-accent-deep) / <alpha-value>)",
        positive: "rgb(var(--c-positive) / <alpha-value>)",
        "positive-deep": "rgb(var(--c-positive-deep) / <alpha-value>)",
        critical: "rgb(var(--c-critical) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Manrope Variable", "Manrope", "system-ui", "sans-serif"],
        arabic: ["Amiri", "Scheherazade New", "serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
        "3xl": "26px",
      },
      boxShadow: {
        lg: "var(--shadow-lg)",
        md: "var(--shadow-md)",
      },
      maxWidth: {
        app: "560px",
        wide: "960px",
      },
    },
  },
  plugins: [],
};

export default config;
