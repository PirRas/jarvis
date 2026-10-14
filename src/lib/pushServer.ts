import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Versand von Push-Nachrichten (nur auf dem Server). Benötigte Umgebungsvariablen in Vercel:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  – Schlüsselpaar für Web-Push
//   SUPABASE_SECRET_KEY                              – Secret Key (bzw. service_role) aus Supabase, nur serverseitig
//   PUSH_CRON_SECRET                                 – gemeinsames Geheimnis mit dem Cron-Job in Supabase

export function pushConfigError() {
  const missing = [
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    !process.env.VAPID_PRIVATE_KEY && "VAPID_PRIVATE_KEY",
    !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) && "SUPABASE_SECRET_KEY",
    !process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
  ].filter(Boolean);
  return missing.length ? `Fehlende Einstellungen in Vercel: ${missing.join(", ")}` : null;
}

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails("mailto:jarvis@nachbereitung.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export type Subscription = { endpoint: string; p256dh: string; auth: string };
export type Message = { title: string; body: string; url: string; tag?: string };

/** Schickt eine Nachricht an alle Geräte; abgelaufene Abos werden zurückgegeben, damit sie gelöscht werden. */
export async function sendToAll(subs: Subscription[], msg: Message) {
  configure();
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          { TTL: 6 * 3600, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
      }
    }),
  );
  return { sent, gone };
}
