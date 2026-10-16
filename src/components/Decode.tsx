"use client";

import { useEffect, useState } from "react";

// Jarvis-Effekte beim Hochfahren der Startseite: nur beim ersten Öffnen pro Sitzung,
// damit sie beim Hin- und Herwechseln zwischen Seiten nicht stören.

const KEY = "jarvis-booted";
let bootAt: number | null = null;

/** true nur in den ersten Sekunden nach dem ersten Öffnen der App in dieser Sitzung. */
export function shouldBoot() {
  if (typeof window === "undefined") return false;
  if (bootAt === null) {
    try {
      bootAt = sessionStorage.getItem(KEY) ? 0 : Date.now();
      sessionStorage.setItem(KEY, "1");
    } catch {
      bootAt = 0;
    }
  }
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return !reduced && Date.now() - bootAt < 4000;
}

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#<>/=+";

/** Text, der sich aus Zufallszeichen von links nach rechts "entschlüsselt". */
export function Decode({ text, active, duration = 900 }: { text: string; active: boolean; duration?: number }) {
  const [shown, setShown] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const fixed = Math.floor(p * text.length);
      let out = text.slice(0, fixed);
      for (let i = fixed; i < text.length; i++) {
        out += text[i] === " " ? " " : i < fixed + 6 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : "";
      }
      setShown(out);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, text, duration]);

  return (
    <span aria-label={text}>
      <span aria-hidden>{active ? shown : text}</span>
    </span>
  );
}
