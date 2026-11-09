"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const GLYPHS = "▮▯◆◇01ABCDEF";
const DURATION = 450;

/** Wrapper pro Pfad: key={pathname} startet die page-in-Animation neu; der erste Seitentitel wird kurz „entschlüsselt“. */
export function PageTitleDecode({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Startseite hat ihr eigenes Decode (Decode.tsx)
    if (pathname === "/heute" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const h1 = ref.current?.querySelector("h1.page-title");
    const node = h1?.childNodes.length === 1 ? h1.firstChild : null;
    // shortcut: nur Titel aus einem einzelnen Textknoten, gemischte Titel bleiben unverändert
    if (!h1 || !node || node.nodeType !== Node.TEXT_NODE) return;
    const original = node.nodeValue ?? "";
    h1.setAttribute("aria-label", original);
    const start = performance.now();
    const id = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / DURATION);
      const keep = Math.floor(p * original.length);
      node.nodeValue = original
        .split("")
        .map((c, i) => (i < keep || c === " " ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join("");
      if (p >= 1) stop();
    }, 40);
    function stop() {
      window.clearInterval(id);
      node!.nodeValue = original;
      h1!.removeAttribute("aria-label");
    }
    return stop;
  }, [pathname]);

  return (
    <div key={pathname} ref={ref} className="page-in">
      {children}
    </div>
  );
}
