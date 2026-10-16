"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileForm } from "@/components/ProfileForm";
import { needsSecondFactor, TwoFactor, TwoFactorChallenge } from "@/components/TwoFactor";
import { clearLocalData, listItems, putItems } from "@/lib/db";
import { DEFAULT_PROFILE, profileMark, readProfile } from "@/lib/profile";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/password";
import { supabase, syncConfigured } from "@/lib/supabase";
import { getSyncStatus, onSyncStatus, syncNow, type SyncStatus } from "@/lib/sync";

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "E-Mail oder Passwort stimmt nicht.";
  if (/email not confirmed/i.test(message))
    return "Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.";
  if (/already registered/i.test(message)) return "Für diese E-Mail gibt es schon ein Konto. Melde dich an.";
  if (/password should be at least/i.test(message)) return "Das Passwort muss mindestens 10 Zeichen lang sein.";
  if (/rate limit/i.test(message)) return "Zu viele Versuche. Warte ein paar Minuten.";
  return message;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null | undefined>();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false); // Link aus der Passwort-vergessen-Mail
  const [mfa, setMfa] = useState<boolean | undefined>(); // true: Code aus der Authenticator-App fehlt noch
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return setUser(null);
    sb.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      setMfa(data.user ? await needsSecondFactor() : false);
    });
    const { data } = sb.auth.onAuthStateChange((e, session) => {
      setUser(session?.user ?? null);
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
    });
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
      setMfa(true); // bis geprüft ist, den angemeldeten Bereich nicht zeigen
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        setMfa(false);
        setMessage({ kind: "error", text: translateAuthError(error.message) });
      } else {
        setPassword("");
        setMfa(await needsSecondFactor());
      }
    } else {
      const problem = await passwordProblem(password, email);
      if (problem) {
        setMessage({ kind: "error", text: problem });
        return setBusy(false);
      }
      if (name.trim()) {
        // Name gleich ins Profil übernehmen; es wird mit dem Konto abgeglichen
        const current = readProfile(await listItems("marks")) ?? DEFAULT_PROFILE;
        await putItems("marks", [profileMark({ ...current, name: name.trim() })]);
      }
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

  async function forgot() {
    if (!email) return setMessage({ kind: "error", text: "Gib oben deine E-Mail-Adresse ein." });
    setBusy(true);
    const { error } = await supabase()!.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/konto` });
    // Nicht verraten, ob es das Konto gibt
    setMessage(error && /rate limit/i.test(error.message) ? { kind: "error", text: translateAuthError(error.message) } : { kind: "ok", text: "Falls es ein Konto gibt, ist ein Link unterwegs." });
    setBusy(false);
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const problem = await passwordProblem(password, user?.email ?? "");
    if (problem) setMessage({ kind: "error", text: problem });
    else {
      const { error } = await supabase()!.auth.updateUser({ password });
      if (error) setMessage({ kind: "error", text: translateAuthError(error.message) });
      else {
        setPassword("");
        setRecovery(false);
        setMessage({ kind: "ok", text: "Neues Passwort gespeichert." });
      }
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

  async function deleteAccount() {
    if (prompt("Dein Konto und alle Daten werden unwiderruflich gelöscht. Tippe zur Bestätigung LÖSCHEN ein.") !== "LÖSCHEN") return;
    setBusy(true);
    setMessage(null);
    const sb = supabase()!;
    // Kein syncNow() vorher: Es soll nichts mehr hochgeladen werden.
    const token = (await sb.auth.getSession()).data.session?.access_token;
    try {
      const res = await fetch("/api/konto/loeschen", { method: "POST", headers: { authorization: `Bearer ${token ?? ""}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Das Konto konnte nicht gelöscht werden. Bitte versuche es später noch einmal.");
      // Erst abmelden, dann leeren: Ohne Sitzung lädt der Abgleich (Timer, Änderungs-Ereignis) nichts mehr hoch.
      await sb.auth.signOut({ scope: "local" });
      await clearLocalData();
      setMessage({ kind: "ok", text: "Dein Konto und alle Daten wurden gelöscht." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Das Konto konnte nicht gelöscht werden. Bitte versuche es später noch einmal." });
    }
    setBusy(false);
  }

  if (user === undefined || (user && mfa === undefined)) return <p className="muted">Lade …</p>;

  // Mit 2FA verlangt Supabase auch fürs neue Passwort zuerst den Code (aal2)
  if (user && mfa) {
    return <TwoFactorChallenge onDone={() => setMfa(false)} onSignOut={() => supabase()!.auth.signOut()} />;
  }

  if (user && recovery) {
    return (
      <form className="sheet stat-panel" style={{ maxWidth: 440, display: "grid", gap: 14 }} onSubmit={setNewPassword}>
        <h2>Neues Passwort setzen</h2>
        <label className="field">
          Neues Passwort
          <input type="password" name="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <p className="muted small" style={{ margin: 0 }}>Mindestens {MIN_PASSWORD_LENGTH}{" "}Zeichen, nicht nur Ziffern, ohne deine E-Mail-Adresse.</p>
        {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"} role={message.kind === "ok" ? "status" : "alert"} style={{ margin: 0 }}>{message.text}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Einen Moment …" : "Passwort speichern"}
        </button>
      </form>
    );
  }

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
                  ? `Zuletzt abgeglichen um ${last.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} Uhr.`
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
          {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p>}
        </section>
        <TwoFactor />
        <p className="muted small">
          Wie Jarvis mit deinen Daten umgeht: <Link href="/datenschutz">Datenschutz</Link>
        </p>
        <section className="sheet stat-panel" style={{ maxWidth: 560, display: "grid", gap: 14 }}>
          <h2>Konto löschen</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Löscht dein Konto und alle online gespeicherten Daten endgültig. Das lässt sich nicht rückgängig machen.
          </p>
          <div className="row">
            <button className="btn btn-danger" onClick={deleteAccount} disabled={busy}>
              Konto endgültig löschen
            </button>
          </div>
          {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"} role={message.kind === "ok" ? "status" : "alert"}>{message.text}</p>}
        </section>
        <ProfileForm />
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
        {mode === "signup" && (
          <label className="field">
            Name
            <input name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Lea" />
          </label>
        )}
        <label className="field">
          E-Mail
          <input type="email" name="email" autoComplete="email" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Passwort
          <input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === "signup" && (
          <p className="muted small" style={{ margin: 0 }}>
            Mindestens {MIN_PASSWORD_LENGTH}{" "}Zeichen, nicht nur Ziffern, ohne deine E-Mail-Adresse. Wir prüfen, ob das Passwort in bekannten Datenlecks vorkommt.
          </p>
        )}
        {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"} role={message.kind === "ok" ? "status" : "alert"} style={{ margin: 0 }}>{message.text}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Einen Moment …" : mode === "login" ? "Anmelden" : "Konto erstellen"}
        </button>
        {mode === "login" && (
          <button type="button" className="btn btn-quiet" onClick={forgot} disabled={busy}>
            Passwort vergessen?
          </button>
        )}
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
        {mode === "signup" && (
          <p className="muted small" style={{ margin: 0 }}>
            Wie Jarvis mit deinen Daten umgeht: <Link href="/datenschutz">Datenschutz</Link>
          </p>
        )}
      </form>
      <ProfileForm />
    </>
  );
}
