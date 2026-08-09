import type { SVGProps } from "react";

/**
 * Line icons drawn on a 24-grid with a 1.6 stroke.
 *
 * Hand-drawn rather than pulled from a package: the set is small, and matching
 * the stroke weight to the typography matters more here than breadth.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconDawn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17h16" />
    <path d="M7.5 17a4.5 4.5 0 0 1 9 0" />
    <path d="M12 4v3M5.6 7.6l2 2M18.4 7.6l-2 2M2.5 21h19" />
  </Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </Svg>
);

export const IconNoon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="11" r="3.4" />
    <path d="M12 3v2M3 11h2M19 11h2M5.6 4.6l1.5 1.5M18.4 4.6l-1.5 1.5" />
    <path d="M3.5 18.5h17" />
  </Svg>
);

export const IconAfternoon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.5" cy="11" r="3.2" />
    <path d="M9.5 4v2M3 11h2M4.6 6.1l1.4 1.4" />
    <path d="M13 18.5h8M3 18.5h6" />
    <path d="M15 13.5c1.6-2.4 5-1.6 5.4 1.1" />
  </Svg>
);

export const IconDusk = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 16h16" />
    <path d="M7.5 16a4.5 4.5 0 0 1 9 0" />
    <path d="M12 12.5V9M8 20h8M3 20h2M19 20h2" />
  </Svg>
);

export const IconNight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.3 8.3 0 1 0 20 14.5Z" />
  </Svg>
);

export const IconCompass = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.2 8.8 13.6 13.6 8.8 15.2l1.6-4.8Z" />
  </Svg>
);

export const IconSettings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.5 20a2 2 0 0 0 3 0" />
  </Svg>
);

export const IconBellOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.7 3.9A6 6 0 0 1 18 8c0 2.3.3 3.9.7 5" />
    <path d="M16.8 16.8H4s2-1 2-7a6 6 0 0 1 .8-3" />
    <path d="M10.5 20a2 2 0 0 0 3 0M3 3l18 18" />
  </Svg>
);

export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.8" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconPlay = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l11-6.5Z" />
  </Svg>
);

export const IconStop = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconWarn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 22 20H2Z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

/** Map a prayer key to its icon. */
export const PRAYER_ICONS = {
  fajr: IconDawn,
  sunrise: IconSun,
  dhuhr: IconNoon,
  asr: IconAfternoon,
  maghrib: IconDusk,
  isha: IconNight,
} as const;
