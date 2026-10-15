"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GEMINI_MODELS, getGeminiKey, getOpenRouterKey, getYouTubeKey, OPENROUTER_MODELS } from "@/lib/gemini";
import { pushState, type PushState } from "@/lib/push";
import { canListen } from "@/lib/speech";
import { syncConfigured } from "@/lib/supabase";
import { getSyncStatus, onSyncStatus, type SyncStatus } from "@/lib/sync";

type Tone = "ok" | "warn" | "off";
type Row = { name: string; text: string; tone: Tone };

const SYNC: Record<SyncStatus["state"], Row["tone"]> = { idle: "ok", syncing: "ok", error: "warn", off: "off" };
const SYNC_TEXT: Record<SyncStatus["state"], string> = { idle: "Abgeglichen", syncing: "Gleicht ab", error: "Gestört", off: "Nicht angemeldet" };
const PUSH_TEXT: Record<PushState, string> = {
  unsupported: "Nicht unterstützt",
  unconfigured: "Nicht eingerichtet",
  "signed-out": "Nicht angemeldet",
  denied: "Blockiert",
  off: "Aus",
  on: "Aktiv",
};

function StatusList({ rows }: { rows: Row[] }) {
  return (
    <ul className="status-list">
      {rows.map((r) => (
        <li key={r.name}>
          <span className={`sync-dot is-${r.tone}`} aria-hidden />
          <span>{r.name}</span>
          <strong>{r.text}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Systemübersicht (Sync, Push, Stimme) und KI-Status (nur gesetzt / nicht gesetzt, nie der Schlüssel selbst). */
export function SystemStatus() {
  const [sync, setSync] = useState<SyncStatus>({ state: "off" });
  const [push, setPush] = useState<PushState | null>(null);
  const [ai, setAi] = useState<{ gemini: boolean; openrouter: boolean; youtube: boolean } | null>(null);
  const [voice, setVoice] = useState<{ listen: boolean; speak: boolean } | null>(null);

  useEffect(() => {
    setSync(getSyncStatus());
    pushState().then(setPush);
    setAi({ gemini: !!getGeminiKey(), openrouter: !!getOpenRouterKey(), youtube: !!getYouTubeKey() });
    setVoice({ listen: canListen(), speak: "speechSynthesis" in window });
    return onSyncStatus(setSync);
  }, []);

  const set = (on: boolean): Pick<Row, "text" | "tone"> => (on ? { text: "Verbunden", tone: "ok" } : { text: "Nicht gesetzt", tone: "off" });
  const system: Row[] = [
    syncConfigured
      ? { name: "Abgleich", text: SYNC_TEXT[sync.state], tone: SYNC[sync.state] }
      : { name: "Abgleich", text: "Nicht eingerichtet", tone: "off" },
    { name: "Push", text: push ? PUSH_TEXT[push] : "Prüfe …", tone: push === "on" ? "ok" : push === "denied" ? "warn" : "off" },
    {
      name: "Stimme",
      text: !voice ? "Prüfe …" : voice.listen && voice.speak ? "Hören und Sprechen" : voice.speak ? "Nur Sprechen" : "Nicht unterstützt",
      tone: voice?.listen && voice.speak ? "ok" : voice?.speak ? "warn" : "off",
    },
  ];
  const models: Row[] = ai
    ? [
        ...GEMINI_MODELS.map((m) => ({ name: m.label, ...set(ai.gemini) })),
        ...OPENROUTER_MODELS.map((m) => ({ name: m.label, ...set(ai.openrouter) })),
        { name: "YouTube-Schlüssel", ...set(ai.youtube) },
      ]
    : [];

  return (
    <>
      <section className="sheet panel">
        <h2 className="panel-title">Systemübersicht</h2>
        <StatusList rows={system} />
      </section>
      <section className="sheet panel">
        <h2 className="panel-title">KI-Status</h2>
        {models.length ? <StatusList rows={models} /> : <p className="muted">Prüfe …</p>}
        <Link className="panel-more" href="/konto">
          Schlüssel verwalten
        </Link>
      </section>
    </>
  );
}
