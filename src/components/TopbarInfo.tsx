"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRemoteRefresh } from "@/components/SyncBadge";
import { SplitFlap } from "@/components/SplitFlap";
import { listItems, onLocalChange } from "@/lib/db";
import { fmtTime } from "@/lib/planner";
import { readProfile } from "@/lib/profile";

/** Datum und Uhrzeit für die Mitte der Kopfzeile (erst nach dem Laden, wegen Hydration). */
export function TopbarClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <div className="topbar-clock" />;
  const d = new Date(now);
  return (
    <div className="topbar-clock">
      <span className="topbar-time"><SplitFlap value={fmtTime(now)} /></span>
      <span className="topbar-date">{d.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}</span>
    </div>
  );
}

/** Profil-Pille mit Vorname aus dem Konto. */
export function ProfilePill() {
  const [name, setName] = useState<string | null>(null);
  const load = useCallback(() => {
    listItems("marks").then((m) => setName(readProfile(m)?.name.trim().split(/\s+/)[0] ?? ""));
  }, []);
  useEffect(() => {
    load();
    return onLocalChange(load);
  }, [load]);
  useRemoteRefresh(load);
  if (name === null) return null;
  return (
    <Link href="/konto#profil" className="profile-pill">
      <span className="profile-dot" aria-hidden>
        {name.charAt(0).toUpperCase() || "·"}
      </span>
      {name || "Profil"}
    </Link>
  );
}
