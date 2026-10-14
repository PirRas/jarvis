import type { NextConfig } from "next";

// Läuft auf Vercel (Gratis-Stufe). Zwei kleine Server-Routen holen Kalender-Abos und Räume aus dem
// Vorlesungsverzeichnis; alles andere läuft im Browser und funktioniert auch offline.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Im Benutzerordner liegt eine weitere package-lock.json; ohne diese Angabe hält Next.js jenen Ordner für das Projekt.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
