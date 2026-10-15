"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listItems, onLocalChange } from "@/lib/db";
import { REMOTE_CHANGE_EVENT } from "@/lib/sync";

// Am Desktop alle Seiten als Sidebar links (Zähler bei Aufgaben). Auf dem Handy unten nur die wichtigsten Seiten und "Mehr",
// das die übrigen als Feld über der Leiste aufklappt.

const MAIN = [
  { href: "/", label: "Heute" },
  { href: "/aufgaben", label: "Aufgaben" },
  { href: "/stundenplan", label: "Stundenplan" },
  { href: "/lernplan", label: "Lernplan" },
];

const MORE = [
  { href: "/kalender", label: "Kalender" },
  { href: "/vorlesungen", label: "Vorlesungen" },
  { href: "/lernen", label: "Lernen" },
  { href: "/fokus", label: "Fokus" },
  { href: "/studium", label: "Studium" },
  { href: "/pharmazie", label: "Pharmazie" },
  { href: "/links", label: "Links" },
  { href: "/karten", label: "Karten" },
  { href: "/statistik", label: "Statistik" },
  { href: "/konto", label: "Konto", mobileOnly: true },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));

export function MainNav() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const [openTodos, setOpenTodos] = useState(0);
  const countTodos = useCallback(() => {
    listItems("todos").then((t) => setOpenTodos(t.filter((x) => !x.done).length));
  }, []);
  useEffect(() => {
    countTodos();
    window.addEventListener(REMOTE_CHANGE_EVENT, countTodos);
    const off = onLocalChange(countTodos);
    return () => {
      off();
      window.removeEventListener(REMOTE_CHANGE_EVENT, countTodos);
    };
  }, [countTodos]);
  const item = ({ href, label, mobileOnly }: { href: string; label: string; mobileOnly?: boolean }) => (
    <Link
      key={href}
      href={href}
      onClick={close}
      className={mobileOnly ? "nav-mobile-only" : undefined}
      aria-current={isActive(path, href) ? "page" : undefined}
    >
      {label}
      {href === "/aufgaben" && openTodos > 0 && <span className="nav-count">{openTodos}</span>}
    </Link>
  );

  return (
    <nav className={`topnav${open ? " open" : ""}`} aria-label="Hauptnavigation">
      {MAIN.map(item)}
      <div className="nav-more" id="nav-more">
        {MORE.map(item)}
      </div>
      <button
        type="button"
        className="nav-more-toggle"
        aria-expanded={open}
        aria-controls="nav-more"
        aria-current={!open && MORE.some((m) => isActive(path, m.href)) ? "page" : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        Mehr
      </button>
    </nav>
  );
}
