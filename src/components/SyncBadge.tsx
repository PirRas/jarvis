"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { syncConfigured } from "@/lib/supabase";
import { getSyncStatus, onSyncStatus, REMOTE_CHANGE_EVENT, startAutoSync, type SyncStatus } from "@/lib/sync";

/** Startet den Abgleich und zeigt seinen Zustand in der Kopfleiste. */
export function SyncBadge() {
  const [status, setStatus] = useState<SyncStatus>({ state: "off" });

  useEffect(() => {
    startAutoSync();
    setStatus(getSyncStatus());
    return onSyncStatus(setStatus);
  }, []);

  if (!syncConfigured) return null;

  const label =
    status.state === "syncing"
      ? "Gleicht ab"
      : status.state === "idle"
        ? "Abgeglichen"
        : status.state === "error"
          ? "Abgleich gestört"
          : "Nicht angemeldet";

  return (
    <Link href="/konto" className={`sync-badge is-${status.state}`} title={status.state === "error" ? status.message : label}>
      <span className="sync-dot" aria-hidden />
      <span className="sync-label">{label}</span>
    </Link>
  );
}

/** Lädt Daten neu, wenn der Abgleich Änderungen von einem anderen Gerät geholt hat. */
export function useRemoteRefresh(reload: () => void) {
  useEffect(() => {
    window.addEventListener(REMOTE_CHANGE_EVENT, reload);
    return () => window.removeEventListener(REMOTE_CHANGE_EVENT, reload);
  }, [reload]);
}
