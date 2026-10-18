import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Streng vor allem bei connect-src: Ein eingeschleustes Skript soll Daten (Supabase-Session im localStorage) nirgends hinschicken können.
const csp = [
  "default-src 'self'",
  // shortcut: 'unsafe-inline' nötig, weil Next.js Inline-Skripte nutzt; Nonces wären strenger, würden aber alle Seiten dynamisch machen.
  `script-src 'self' 'unsafe-inline'${prod ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://thumb.wikimedia.org https://upload.wikimedia.org https://i.ytimg.com https://pubchem.ncbi.nlm.nih.gov",
  "font-src 'self' data:",
  ["connect-src 'self'", supabase, supabase.replace(/^https:/, "wss:"), "https://generativelanguage.googleapis.com https://openrouter.ai https://www.googleapis.com https://pubchem.ncbi.nlm.nih.gov https://www.ebi.ac.uk https://api.pwnedpasswords.com"].filter(Boolean).join(" "),
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(prod ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

// Läuft auf Vercel (Gratis-Stufe). Zwei kleine Server-Routen holen Kalender-Abos und Räume aus dem
// Vorlesungsverzeichnis; alles andere läuft im Browser und funktioniert auch offline.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Im Benutzerordner liegt eine weitere package-lock.json; ohne diese Angabe hält Next.js jenen Ordner für das Projekt.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
