import type { MetadataRoute } from "next";

// Lets Android/desktop install NovaBot as a standalone app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NovaBot",
    short_name: "NovaBot",
    description: "Your team of always-on Bots",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#fafafa",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
