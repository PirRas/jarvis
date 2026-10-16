"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Mark } from "@/lib/assistant";
import { deleteItems, putItems } from "@/lib/db";
import { appAllowExact, appExactAllowed, isNativeApp } from "@/lib/native";
import { disablePush, enablePush, pushState, sendTestPush, type PushState } from "@/lib/push";
import { enabledKinds, pushOffMark, REMINDER_KINDS, type ReminderKind } from "@/lib/reminders";

const TEXT: Record<PushState, string> = {
  unsupported:
    "Dieser Browser unterstützt keine Push-Nachrichten. Auf dem Handy Jarvis in Chrome öffnen und «Zum Startbildschirm hinzufügen»; auf dem iPhone geht es nur als Startbildschirm-App.",
  unconfigured: "Push ist noch nicht fertig eingerichtet: Die Schlüssel fehlen noch in den Vercel-Einstellungen.",
  "signed-out": "Für Erinnerungen braucht Jarvis dein Konto, damit der Server weiss, wann er dir schreiben soll.",
  denied: "Benachrichtigungen sind für diese Seite im Browser blockiert. In den Website-Einstellungen (Schloss-Symbol neben der Adresse) erlauben.",
  off: "Auf diesem Gerät sind Erinnerungen noch aus.",
  on: "Erinnerungen sind auf diesem Gerät eingeschaltet.",
};

// In der Android-App plant das Handy die Erinnerungen selbst (ohne Server und ohne Konto).
const APP_TEXT: Partial<Record<PushState, string>> = {
  denied: "Benachrichtigungen sind für Jarvis blockiert. In den Android-Einstellungen unter Apps › Jarvis › Benachrichtigungen erlauben.",
  off: "Auf diesem Handy sind Erinnerungen noch aus.",
  on: "Erinnerungen sind auf diesem Handy eingeschaltet. Jarvis plant sie bei jedem Öffnen neu.",
};

/** Erinnerungen (Push) auf diesem Gerät ein-/ausschalten und festlegen, woran Jarvis erinnert. */
export function PushSetup({ marks, compact = false }: { marks: Mark[]; compact?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // null = Browser; sonst ob pünktliche Alarme («Wecker und Erinnerungen») erlaubt sind
  const [exact, setExact] = useState<boolean | null>(null);
  const kinds = enabledKinds(marks);

  useEffect(() => {
    pushState().then(setState);
    if (isNativeApp()) appExactAllowed().then(setExact);
  }, []);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setState(await pushState());
      if (isNativeApp()) setExact(await appExactAllowed());
      setBusy(false);
    }
  }

  async function toggleKind(kind: ReminderKind, on: boolean) {
    if (on) await deleteItems("marks", [pushOffMark(kind)]);
    else await putItems("marks", [{ id: pushOffMark(kind), createdAt: Date.now() }]);
  }

  if (!state) return null;
  if (compact && state === "on") return null;

  return (
    <section className={`sheet panel push-setup is-${state}`}>
      <div className="row spread">
        <h2 className="panel-title">Erinnerungen aufs Handy</h2>
        {state === "on" && <span className="pill push-on">eingeschaltet</span>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {(exact !== null && APP_TEXT[state]) || TEXT[state]}
      </p>
      {exact === false && state === "on" && (
        <p className="small muted" style={{ margin: 0 }}>
          Ohne die Erlaubnis «Wecker und Erinnerungen» kann Android Erinnerungen um ein paar Minuten verschieben.
        </p>
      )}
      <div className="row">
        {(state === "off" || state === "denied") && (
          <button className="btn btn-primary" disabled={busy} onClick={() => run(enablePush, "Eingeschaltet. Schick dir zur Kontrolle eine Testnachricht.")}>
            {busy ? "Schalte ein …" : "Erinnerungen einschalten"}
          </button>
        )}
        {state === "signed-out" && (
          <Link className="btn btn-primary" href="/konto">
            Zum Konto
          </Link>
        )}
        {state === "on" && (
          <>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await sendTestPush();
                  setMsg({
                    ok: true,
                    text: exact !== null ? "Testnachricht kommt in ein paar Sekunden." : `Testnachricht an ${r.sent} von ${r.devices} Geräten verschickt.`,
                  });
                })
              }
            >
              Testnachricht senden
            </button>
            {exact === false && (
              <button className="btn" disabled={busy} onClick={() => run(appAllowExact)}>
                Pünktlich erinnern erlauben
              </button>
            )}
            <button className="btn btn-quiet" disabled={busy} onClick={() => run(disablePush, "Auf diesem Gerät ausgeschaltet.")}>
              Auf diesem Gerät ausschalten
            </button>
          </>
        )}
      </div>
      {msg && <p className={msg.ok ? "ok-note small" : "error small"}>{msg.text}</p>}

      {!compact && (state === "on" || state === "off") && (
        <fieldset className="push-kinds">
          <legend className="small muted">Woran soll Jarvis erinnern? (gilt für alle deine Geräte)</legend>
          {REMINDER_KINDS.map((k) => (
            <label key={k.id} className="check">
              <input type="checkbox" checked={kinds.has(k.id)} onChange={(e) => toggleKind(k.id, e.target.checked)} />
              <span>
                {k.label} <span className="muted small">· {k.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
