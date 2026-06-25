import type { IconKey } from "@/lib/types";

const COMMON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
};

export function PrayerIcon({ name }: { name: IconKey }) {
  switch (name) {
    case "dawn":
      return (
        <svg {...COMMON}>
          <path d="M17 18a5 5 0 0 0-10 0" />
          <line x1="12" y1="2" x2="12" y2="9" />
          <line x1="4.2" y1="10.2" x2="5.6" y2="11.6" />
          <line x1="18.4" y1="11.6" x2="19.8" y2="10.2" />
          <line x1="2" y1="18" x2="22" y2="18" />
          <polyline points="8 6 12 9 16 6" opacity=".55" />
        </svg>
      );
    case "sun":
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      );
    case "noon":
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
        </svg>
      );
    case "after":
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="11" r="4" />
          <path d="M2 18h20" />
          <path d="M4 12l2 1M20 12l-2 1" opacity=".6" />
          <line x1="12" y1="3" x2="12" y2="6" />
        </svg>
      );
    case "dusk":
      return (
        <svg {...COMMON}>
          <path d="M17 18a5 5 0 0 0-10 0" />
          <line x1="2" y1="18" x2="22" y2="18" />
          <path d="M12 9V2" />
          <polyline points="8 5 12 2 16 5" opacity=".55" />
          <line x1="4.5" y1="11" x2="6" y2="12" />
          <line x1="19.5" y1="11" x2="18" y2="12" />
        </svg>
      );
    case "night":
      return (
        <svg {...COMMON}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5z" />
          <circle cx="17" cy="6" r=".6" fill="currentColor" />
        </svg>
      );
  }
}
