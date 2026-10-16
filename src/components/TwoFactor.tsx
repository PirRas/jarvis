"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Prüft, ob die Sitzung noch einen zweiten Faktor braucht (Stufe aal1, Konto hat aber 2FA). */
export async function needsSecondFactor() {
  const { data } = await supabase()!.auth.mfa.getAuthenticatorAssuranceLevel();
  return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

async function verifiedFactorId() {
  const { data } = await supabase()!.auth.mfa.listFactors();
  return data?.totp[0]?.id ?? null; // totp enthält nur bestätigte Faktoren
}

async function verify(code: string) {
  const factorId = await verifiedFactorId();
  if (!factorId) return "Keine Zwei-Faktor-Anmeldung gefunden.";
  const { error } = await supabase()!.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  return error ? (/rate limit/i.test(error.message) ? "Zu viele Versuche. Warte ein paar Minuten." : "Der Code stimmt nicht.") : null;
}

function CodeInput({ code, setCode }: { code: string; setCode: (c: string) => void }) {
  return (
    <label className="field">
      6-stelliger Code
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
    </label>
  );
}

/** Anmelde-Schritt: Code aus der Authenticator-App eingeben. */
export function TwoFactorChallenge({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await verify(code);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
    } else onDone();
  }

  return (
    <form className="sheet stat-panel" style={{ maxWidth: 440, display: "grid", gap: 14 }} onSubmit={submit}>
      <h2>Code aus deiner Authenticator-App</h2>
      <CodeInput code={code} setCode={setCode} />
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}
      <button className="btn btn-primary" disabled={busy || code.length !== 6}>
        {busy ? "Einen Moment …" : "Bestätigen"}
      </button>
      <button type="button" className="btn btn-quiet" onClick={onSignOut}>
        Abmelden
      </button>
    </form>
  );
}

/** Abschnitt im Konto: Zwei-Faktor-Anmeldung ein- und ausschalten. */
export function TwoFactor() {
  const [active, setActive] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [askCode, setAskCode] = useState(false); // Ausschalten braucht aal2
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function refresh() {
    setActive((await verifiedFactorId()) !== null);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function start() {
    const sb = supabase()!;
    setBusy(true);
    setMessage(null);
    // Unbestätigte alte Versuche entfernen, sonst scheitert enroll am gleichen Namen
    const { data: list } = await sb.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Jarvis" });
    if (error) setMessage({ kind: "error", text: error.message });
    else setSetup({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setBusy(false);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase()!;
    setBusy(true);
    setMessage(null);
    if (setup) {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: setup.factorId, code });
      if (error) setMessage({ kind: "error", text: "Der Code stimmt nicht." });
      else {
        setSetup(null);
        setMessage({ kind: "ok", text: "Zwei-Faktor-Anmeldung ist eingeschaltet." });
        await refresh();
      }
    } else {
      const err = await verify(code); // hebt die Sitzung auf aal2
      if (err) setMessage({ kind: "error", text: err });
      else {
        setAskCode(false);
        await turnOff();
      }
    }
    setCode("");
    setBusy(false);
  }

  async function turnOff() {
    const sb = supabase()!;
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") return setAskCode(true);
    if (!window.confirm("Zwei-Faktor-Anmeldung wirklich ausschalten?")) return;
    const factorId = await verifiedFactorId();
    const { error } = factorId ? await sb.auth.mfa.unenroll({ factorId }) : { error: null };
    if (error) setMessage({ kind: "error", text: error.message });
    else setMessage({ kind: "ok", text: "Zwei-Faktor-Anmeldung ist ausgeschaltet." });
    await refresh();
  }

  return (
    <section className="sheet stat-panel" style={{ maxWidth: 560, display: "grid", gap: 14 }}>
      <h2>Zwei-Faktor-Anmeldung</h2>
      <p style={{ margin: 0 }}>{active === null ? "Lade …" : active ? "Aktiv: Beim Anmelden brauchst du zusätzlich einen Code aus deiner Authenticator-App." : "Aus. Mit einer Authenticator-App schützt du dein Konto zusätzlich."}</p>
      {setup ? (
        <form onSubmit={confirm} style={{ display: "grid", gap: 14 }}>
          <p className="muted small" style={{ margin: 0 }}>
            Scanne den QR-Code mit einer Authenticator-App (z. B. Google Authenticator oder Aegis) und gib den angezeigten Code ein.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR-Code für die Authenticator-App" width={180} height={180} style={{ background: "#fff", padding: 8 }} />
          <p className="muted small" style={{ margin: 0, wordBreak: "break-all" }}>
            Oder Schlüssel abtippen: {setup.secret}
          </p>
          <CodeInput code={code} setCode={setCode} />
          <div className="row">
            <button className="btn btn-primary" disabled={busy || code.length !== 6}>
              Einschalten
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => { setSetup(null); setCode(""); }}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : askCode ? (
        <form onSubmit={confirm} style={{ display: "grid", gap: 14 }}>
          <p className="muted small" style={{ margin: 0 }}>Zum Ausschalten bestätige zuerst mit einem Code aus deiner App.</p>
          <CodeInput code={code} setCode={setCode} />
          <div className="row">
            <button className="btn btn-danger" disabled={busy || code.length !== 6}>
              Ausschalten
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => { setAskCode(false); setCode(""); }}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : active !== null ? (
        <div className="row">
          {active ? (
            <button className="btn btn-danger" onClick={turnOff} disabled={busy}>
              Ausschalten
            </button>
          ) : (
            <button className="btn btn-primary" onClick={start} disabled={busy}>
              Einschalten
            </button>
          )}
        </div>
      ) : null}
      {message && <p className={message.kind === "ok" ? "verdict-ok small" : "error small"} style={{ margin: 0 }}>{message.text}</p>}
    </section>
  );
}
