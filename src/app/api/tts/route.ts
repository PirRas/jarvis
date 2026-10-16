// Vorlesen mit ElevenLabs: leitet den Text mit dem Schlüssel der Person an ElevenLabs weiter und gibt MP3 zurück.
// Läuft über den Server, weil ElevenLabs Browser-Anfragen von fremden Seiten nicht zuverlässig erlaubt (CORS).
// Der Schlüssel wird nicht gespeichert.

export const dynamic = "force-dynamic";

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "2HRQZj4BjKZ0bVgy6Ikf";
const MAX_CHARS = 2500;
const headers = { "cache-control": "no-store" };

export async function POST(req: Request) {
  const key = req.headers.get("x-elevenlabs-key")?.trim() ?? "";
  if (!/^[\w-]{20,200}$/.test(key)) return Response.json({ error: "ElevenLabs-Schlüssel fehlt oder ist ungültig." }, { status: 400, headers });

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text === "string") text = body.text.trim().slice(0, MAX_CHARS);
  } catch {}
  if (!text) return Response.json({ error: "Kein Text." }, { status: 400, headers });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    // Flash v2.5: schnell genug für Gespräche und halb so teuer wie Multilingual v2
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5", language_code: "de" }),
  }).catch(() => null);
  if (!res) return Response.json({ error: "ElevenLabs nicht erreichbar." }, { status: 502, headers });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { detail?: { message?: string } | string } | null;
    const msg = typeof detail?.detail === "string" ? detail.detail : detail?.detail?.message;
    return Response.json({ error: msg || `ElevenLabs-Fehler ${res.status}` }, { status: res.status === 401 ? 401 : 502, headers });
  }
  return new Response(res.body, { headers: { ...headers, "content-type": "audio/mpeg" } });
}
