import type { Metadata, Viewport } from "next";

// Self-hosted from npm so the UI renders correctly offline and no request
// ever leaves the device for a font.
import "@fontsource-variable/manrope";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "./globals.css";

import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL("https://awqat.app"),
  title: {
    default: "Awqāt — Shia Prayer Times",
    template: "%s · Awqāt",
  },
  description:
    "Ja'fari (Shia) prayer times computed on your device for your exact coordinates. Living sky view, Qibla compass, built-in adhan library and prayer notifications that actually arrive. Works offline.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The hero bleeds into the notch area on iPhone.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0E1F" },
    { media: "(prefers-color-scheme: light)", color: "#F7F3EB" },
  ],
};

/**
 * Applied before first paint so a stored light theme never flashes dark.
 * Kept tiny and dependency-free on purpose.
 */
const THEME_BOOTSTRAP = `(function(){try{
var s=localStorage.getItem('awqat.theme')||'system';
var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-theme',d?'dark':'light');
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
