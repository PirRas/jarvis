import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Holt einen News-Feed (RSS/Atom), z. B. die privaten Neuigkeiten aus ADAM. Browser dürfen fremde Feeds
// wegen CORS nicht direkt laden. Die Adresse kommt per POST, damit Zugangsdaten nicht in Logs landen.
// Zugangsdaten in der Adresse (https://benutzer:passwort@host/…) werden als Basic-Auth gesendet,
// aber nur an den ursprünglichen Host, nie an ein Weiterleitungsziel auf einem anderen Host.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function checkUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^feeds?:\/\//i, "https://"));
  } catch {
    throw new Error("Das ist keine gültige Adresse.");
  }
  if (url.protocol !== "https:") throw new Error("Nur https-Adressen sind erlaubt.");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal"))
    throw new Error("Diese Adresse ist nicht erlaubt.");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(privateAddress)) throw new Error("Diese Adresse ist nicht erlaubt.");
  return url;
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Ungültige Anfrage.");
  }
  if (typeof body.url !== "string" || body.url.length > 2000) return fail("Adresse fehlt.");

  try {
    let url = await checkUrl(body.url);
    // Zugangsdaten aus der Adresse lösen; fetch() erlaubt keine Adressen mit Benutzer/Passwort
    const authHost = url.host;
    const auth =
      url.username || url.password
        ? "Basic " + Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString("base64")
        : null;
    url.username = "";
    url.password = "";

    let res: Response | null = null;
    // Weiterleitungen selbst folgen, damit jedes Ziel geprüft wird
    for (let hop = 0; hop < 4; hop++) {
      const headers: Record<string, string> = {
        accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5",
        "user-agent": "Jarvis-Uni-Cockpit/1.0",
      };
      if (auth && url.host === authHost) headers.authorization = auth;
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        url = await checkUrl(new URL(loc, url).toString());
        url.username = "";
        url.password = "";
        continue;
      }
      break;
    }
    if (!res) return fail("Der Feed ist nicht erreichbar.", 502);
    if (res.status === 401 || res.status === 403)
      return fail(
        auth
          ? "Zugriff verweigert. Stimmen Benutzername und Feed-Passwort?"
          : "Zugriff verweigert. Dieser Feed braucht Benutzername und Feed-Passwort.",
        502,
      );
    if (!res.ok) return fail(`Der Feed antwortet mit Fehler ${res.status}.`, 502);

    const reader = res.body?.getReader();
    if (!reader) return fail("Leere Antwort.", 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return fail("Der Feed ist zu gross (über 3 MB).", 502);
      }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text))
      return fail("Unter dieser Adresse liegt kein News-Feed (RSS oder Atom).", 502);
    return new Response(text, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/timeout|aborted/i.test(msg)) return fail("Der Feed hat nicht rechtzeitig geantwortet.", 504);
    if (/ENOTFOUND|getaddrinfo/i.test(msg)) return fail("Diese Adresse gibt es nicht.", 502);
    return fail(msg, 502);
  }
}
