import { adminClient, pushConfigError, sendToAll } from "@/lib/pushServer";

// Testnachricht an alle Geräte der angemeldeten Person (Anmeldung über das Supabase-Zugriffstoken).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const configError = pushConfigError();
  if (configError) return Response.json({ error: configError }, { status: 500 });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const db = adminClient();
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return Response.json({ error: "Anmeldung ungültig. Bitte neu anmelden." }, { status: 401 });

  const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", auth.user.id);
  if (!subs?.length) return Response.json({ error: "Auf keinem Gerät sind Benachrichtigungen eingeschaltet." }, { status: 400 });

  const res = await sendToAll(subs, {
    title: "Jarvis",
    body: "Benachrichtigungen funktionieren. Ich erinnere dich an Aufgaben, Prüfungen und Lektionen.",
    url: "/aufgaben",
    tag: "test",
  });
  if (res.gone.length) await db.from("push_subscriptions").delete().in("endpoint", res.gone);
  return Response.json({ sent: res.sent, devices: subs.length });
}
