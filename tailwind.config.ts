import type { Config } from "tailwindcss";

// The full visual system lives in app/globals.css (CSS variables + component
// classes). Tailwind is wired up for utility tweaks and exposes the core
// brand tokens so you can reach for `text-gold`, `bg-ink`, etc.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1026",
        "ink-2": "#0E1430",
        gold: "#E8B86A",
        "gold-bright": "#F4D696",
        "gold-deep": "#C9923C",
        emerald: "#5FD0AE",
        cream: "#F5EFE3",
        rose: "#E0879A",
      },
      fontFamily: {
        sans: ["'Manrope Variable'", "system-ui", "sans-serif"],
        arabic: ["'Amiri'", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
