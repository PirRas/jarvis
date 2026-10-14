import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nachbereitung",
    short_name: "Nachbereitung",
    description: "Vorlesungen nachbereiten und mit Karteikarten und Quiz für die Prüfung lernen.",
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
    shortcuts: [{ name: "Lernen", url: "/lernen" }],
  };
}
