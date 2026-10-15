"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Schwebender Mikrofon-Knopf auf allen Seiten, führt zum Sprachbildschirm. */
export function JarvisButton() {
  if (usePathname() === "/jarvis") return null;
  return (
    <Link href="/jarvis" className="jarvis-fab" aria-label="Jarvis – Sprachsteuerung">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0014 0M12 18v3" />
      </svg>
    </Link>
  );
}
