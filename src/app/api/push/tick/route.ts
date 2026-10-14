import { timingSafeEqual } from "node:crypto";
import { adminClient, pushConfigError, sendToAll, type Subscription } from "@/lib/pushServer";

// Wird alle 5 Minuten vom Cron-Job in Supabase aufgerufen und verschickt fällige Erinnerungen.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LATE_LIMIT_MS = 2 * 60 * 60 * 1000; // Erinnerungen, die über 2 Stunden zu spät wären, verfallen

function authorized(req: Request) {
  const secret = process.env.PUSH_CRON_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Nicht erlaubt." }, { status: 401 });
  const configError = pushConfigError();
  if (configError) return Response.json({ error: configError }, { status: 500 });

  const db = adminClient();
  const now = new Date();
  // Fällige Einträge zuerst als verschickt markieren ("beanspruchen"), dann senden:
  // so kommt nichts doppelt, auch wenn sich zwei Aufrufe überschneiden.
  const { data: due, error } = await db
    .from("push_schedule")
    .update({ sent_at: now.toISOString() })
    .is("sent_at", null)
    .lte("due_at", now.toISOString())
    .select("user_id,key,title,body,url,due_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!due?.length) return Response.json({ sent: 0 });

  const users = [...new Set(due.map((r) => r.user_id as string))];
  const { data: subs } = await db.from("push_subscriptions").select("user_id,endpoint,p256dh,auth").in("user_id", users);

  let sent = 0;
  const gone = new Set<string>();
  for (const r of due.sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))) {
    // Über 2 Stunden zu spät (z. B. Ausfall): verfallen lassen statt mitten in der Nacht nachliefern
    if (now.getTime() - new Date(r.due_at as string).getTime() > LATE_LIMIT_MS) continue;
    const mine = (subs ?? []).filter((s) => s.user_id === r.user_id && !gone.has(s.endpoint)) as (Subscription & { user_id: string })[];
    const res = await sendToAll(mine, { title: r.title, body: r.body, url: r.url, tag: r.key });
    sent += res.sent;
    res.gone.forEach((g) => gone.add(g));
  }
  if (gone.size) await db.from("push_subscriptions").delete().in("endpoint", [...gone]);
  return Response.json({ due: due.length, sent, removedDevices: gone.size });
}
