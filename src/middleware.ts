import { NextResponse, type NextRequest } from "next/server";

// Einfaches Rate-Limit pro IP und Route für die offenen API-Routen.
// shortcut: Zähler liegen im Speicher der einzelnen Server-Instanz (Vercel kann mehrere starten);
// robuster wäre eine Vercel-Firewall-Regel.
const WINDOW_MS = 60_000;
// /api/vv wird beim Stundenplan pro Kurs einmal (nacheinander) abgefragt, daher höher.
const LIMITS: Record<string, number> = { "/api/vv": 120, "/api/konto/loeschen": 5 };
const DEFAULT_LIMIT = 30;

const hits = new Map<string, { count: number; reset: number }>();
let lastSweep = 0;

export function middleware(req: NextRequest) {
  const now = Date.now();
  if (now - lastSweep > WINDOW_MS) {
    lastSweep = now;
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unbekannt";
  const path = req.nextUrl.pathname;
  const key = `${path}|${ip}`;
  let h = hits.get(key);
  if (!h || h.reset <= now) hits.set(key, (h = { count: 0, reset: now + WINDOW_MS }));
  h.count++;

  if (h.count > (LIMITS[path] ?? DEFAULT_LIMIT)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429, headers: { "retry-after": String(Math.ceil((h.reset - now) / 1000)) } },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/ics", "/api/rss", "/api/vv", "/api/push/test", "/api/konto/loeschen"] };
