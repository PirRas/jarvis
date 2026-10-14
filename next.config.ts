import type { NextConfig } from "next";

// Läuft auf Vercel (Gratis-Stufe). Zwei kleine Server-Routen holen Kalender-Abos und Räume aus dem
// Vorlesungsverzeichnis; alles andere läuft im Browser und funktioniert auch offline.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
