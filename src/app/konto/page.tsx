"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { clearLocalData } from "@/lib/db";
import { supabase, syncConfigured } from "@/lib/supabase";
import { getSyncStatus, onSyncStatus, syncNow, type SyncStatus } from "@/lib/sync";

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-Mail oder Passwort stimmt nicht.";
  if (/email not confirmed/i.test(message))
    return "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.";
  if (/already registered/i.test(message)) return "Für diese E-Mail gibt es schon ein Konto. Melde dich an.";
  if (/password should be at least/i.test(message)) return "Das Passwort muss mindestens 6 Zeichen lang sein.";
  if (/rate limit/i.test(message)) return "Zu viele Versuche. Warte ein paar Minuten.";
  return message;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null | undefined>();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return setUser(null);
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    const off = onSyncStatus(setStatus);
    return () => {
      data.subscription.unsubscribe();
      off();
    };
  }, []);

  if (!syncConfigured) {
    return (
      <div className="sheet empty">
        <h2>Abgleich ist noch nicht eingerichtet</h2>
        <p className="muted" style={{ maxWidth: "60ch" }}>
          Für den Abgleich zwischen Handy und PC braucht die App ein kostenloses Supabase-Projekt. Die Schritte stehen in
          der README. Bis dahin werden deine Daten nur auf diesem Gerät gespeichert.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase()!;
    setBusy(true);
    setMessage(null);
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMessage({ kind: "error", text: translateAuthError(error.message) });
      else setPassword("");
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/konto` },
      });
      if (error) setMessage({ kind: "error", text: translateAuthError(error.message) });
      else if (!data.session)
        setMessage({ kind: "ok", text: "Fast geschafft: Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben. Danach hier anmelden." });
      else setPassword("");
    }
    setBusy(false);
  }

  async function signOut(wipe: boolean) {
    if (wipe && !confirm("Abmelden und alle Vorlesungen auf diesem Gerät entfernen? In deinem Konto bleiben sie erhalten.")) return;
    await syncNow(); // letzte Änderungen sichern
    await supabase()!.auth.signOut();
    if (wipe) await clearLocalData();
    setMessage({ kind: "ok", text: wipe ? "Abgemeldet. Die Daten auf diesem Gerät wurden entfernt." : "Abgemeldet." });
  }

  if (user === undefined) return <p className="muted">Lade …</p>;

  if (user) {
    const last = "lastSync" in status && status.lastSync ? new Date(status.lastSync) : null;
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">Konto</h1>
            <p className="lede">Angemeldet als {user.email}. Vorlesungen, Karten und Lernfortschritt werden auf allen Geräten abgeglichen, auf denen du angemeldet bist.</p>
          </div>
        </div>
        <section className="sheet stat-panel" style={{ maxWidth: 560, display: "grid", gap: 14 }}>
          <h2>Abgleich</h2>
          <p style={{ margin: 0 }}>
            {status.state === "syncing"
              ? "Gleicht gerade ab …"
              : status.state === "error"
                ? status.message
                : last
                  ? `Zuletzt abgeglichen um ${last.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr.`
                  : "Noch nicht abgeglichen."}
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            Der Abgleich läuft automatisch nach jeder Änderung, beim Öffnen der App und alle zwei Minuten.
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => syncNow()} disabled={status.state === "syncing"}>
              Jetzt abgleichen
            </button>
            <button className="btn btn-quiet" onClick={() => signOut(false)}>
              Abmelden
            </button>
            <button className="btn btn-danger" onClick={() => signOut(true)}>
              Abmelden und Gerät leeren
            </button>
          </div>
          {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"}>{message.text}</p>}
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{mode === "login" ? "Anmelden" : "Konto erstellen"}</h1>
          <p className="lede">
            Mit einem kostenlosen Konto hast du deine Vorlesungen und deinen Lernstand auf Handy und PC. Ohne Konto bleibt
            alles nur auf diesem Gerät.
          </p>
        </div>
      </div>
      <form className="sheet stat-panel" style={{ maxWidth: 440, display: "grid", gap: 14 }} onSubmit={submit}>
        <label className="field">
          E-Mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Passwort
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"} style={{ margin: 0 }}>{message.text}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Einen Moment …" : mode === "login" ? "Anmelden" : "Konto erstellen"}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage(null);
          }}
        >
          {mode === "login" ? "Noch kein Konto? Konto erstellen" : "Schon ein Konto? Anmelden"}
        </button>
        <p className="muted small" style={{ margin: 0 }}>
          Was schon auf diesem Gerät gespeichert ist, wird nach der Anmeldung in dein Konto übernommen.
        </p>
      </form>
    </>
  );
}
