import { adminClient } from "@/lib/pushServer";

// Löscht das Konto der angemeldeten Person. Alle Tabellen hängen per "on delete cascade" am Auth-Nutzer.
// Mit 2FA ist zusätzlich eine Sitzung mit Stufe aal2 nötig.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "cache-control": "no-store" };

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return Response.json({ error: "Fehlende Einstellungen in Vercel: SUPABASE_SECRET_KEY" }, { status: 500, headers });
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401, headers });
  const db = adminClient();
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return Response.json({ error: "Anmeldung ungültig. Bitte neu anmelden." }, { status: 401, headers });
  const user = auth.user;

  const { data: mfa, error: mfaError } = await db.auth.admin.mfa.listFactors({ userId: user.id });
  if (mfaError) return Response.json({ error: mfaError.message }, { status: 500, headers });
  if (mfa.factors.some((f) => f.status === "verified")) {
    // Das Token ist durch getUser bereits geprüft; hier wird nur die Stufe (aal) gelesen.
    let aal: string | undefined;
    try {
      aal = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).aal;
    } catch {}
    if (aal !== "aal2") {
      return Response.json({ error: "Bitte zuerst mit dem Code aus deiner Authenticator-App bestätigen." }, { status: 403, headers });
    }
  }

  const { error: delError } = await db.auth.admin.deleteUser(user.id);
  if (delError) return Response.json({ error: delError.message }, { status: 500, headers });
  return Response.json({ ok: true }, { headers });
}
