import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jarvis – Uni-Cockpit",
    short_name: "Jarvis",
    description: "Stundenplan mit Live-Räumen, Kalender, Prüfungen, Links und Nachbereitung.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef1f6",
    theme_color: "#2c46c8",
    lang: "de",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Heute", url: "/" },
      { name: "Kalender", url: "/kalender" },
      { name: "Lernen", url: "/lernen" },
    ],
  };
}
