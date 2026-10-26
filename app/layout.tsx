import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaBot",
  description: "Your team of always-on Bots, powered by your own API key.",
  // Opens full screen (no Safari bars) when added to the iPhone home screen
  appleWebApp: { capable: true, title: "NovaBot", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch/home indicator; the CSS pads with safe-area insets
  viewportFit: "cover",
  // Android Chrome: shrink the layout when the keyboard opens instead of covering the composer
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
