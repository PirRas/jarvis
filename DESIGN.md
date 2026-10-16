# DESIGN.md – Jarvis

> Gestaltungsregeln für Menschen und KI-Agenten. Gilt ab 2026-10-16 und ersetzt das frühere Sci-Fi-HUD (Cyan-Glow, Eck-Klammern, Reaktor-Orb).
> **Grundregel:** Tokens in `:root` von `src/app/globals.css` sind die Wahrheit. Neue Werte dort anlegen, nie Hex-Werte in Komponenten kopieren.

---

## 1. Idee

Jarvis ist ein Werkzeug für den Alltag im Pharmaziestudium an der Uni Basel: Stundenplan, Räume, Fristen, Karteikarten, Labor- und Rechenhilfen. Vorbild ist nicht ein Kommandozentrum aus dem Film, sondern das, was auf dem Labortisch liegt: **das Laborjournal und die Etikette auf der Arzneimittelpackung.**

- Ruhige, helle Flächen wie Papier. Daten sind die Hauptsache, nicht Effekte.
- Jede Information steht so klar wie auf einer Etikette: Name, Menge, Zeit, Ort. Nichts darf verwechselt werden.
- Ein Akzent (Mint-Petrol, angelehnt an das Mint der Uni Basel), sonst Graustufen und Statusfarben.
- Dunkel nur, wenn das Gerät es verlangt (`prefers-color-scheme: dark`), mit gleicher Ruhe.

**Was es nicht gibt:** Leuchten (Glow), Verläufe, Glas/Blur, Eck-Klammern, Raster-Hintergrund, rotierende Ringe, Zeichen-Entschlüsselung, Schimmer auf Buttons, Karten mit farbigem Linksrand, Grossbuchstaben mit Sperrung, Emojis, Gedankenstrich-Ketten und Werbewörter.

---

## 2. Schrift

Eine Familie in zwei Schnitten, beide über `next/font/google` lokal eingebunden (keine externe Anfrage, CSP bleibt `font-src 'self'`):

| Variable | Schrift | Wofür | Warum |
|---|---|---|---|
| `--font-ui` | **Atkinson Hyperlegible Next** (variabel) | Alles: Überschriften, Text, Navigation, Zahlen | Für Lesbarkeit gebaut: I/l/1 und 0/O sind klar verschieden. Bei Dosierungen, Substanznamen und Raumnummern zählt genau das. |
| `--font-mono` | **Atkinson Hyperlegible Mono** | Nur Summenformeln, Rechner-Ergebnisse, Codes (2FA) | Ziffern stehen bündig untereinander. |

`--font-hud` gibt es nicht mehr (Alias auf `--font-ui`, bis alle Stellen umgestellt sind).

**Skala** (nicht mehr als diese Grössen):

| Token | Grösse | Rolle |
|---|---|---|
| `--step--1` | 0.875rem | Meta, Labels, Zähler |
| `--step-0` | 1rem | Fliesstext (min. 16 px) |
| `--step-1` | 1.1875rem | Panel-Titel |
| `--step-2` | 1.5rem | Abschnittstitel |
| `--step-3` | 2.125rem | Uhrzeit, grosse Kennzahlen |
| `--step-4` | 3rem | Seitentitel (Desktop) |

- Überschriften: Gewicht 700, `letter-spacing: -0.01em`, `line-height: 1.15`, `text-wrap: balance`. **Satzschreibung**, keine Grossbuchstaben mit Sperrung.
- Fliesstext: 400, `line-height: 1.5`, max. 70ch.
- Zahlen, die sich ändern (Zeiten, Zähler, Countdowns, Noten): `font-variant-numeric: tabular-nums`.
- Marke «Jarvis» in der Kopfzeile: normal geschrieben, 700, `--step-1`.

---

## 3. Farben

Variablennamen bleiben aus Kompatibilität (`--royal` ist der Akzent). Alle Paare sind nach WCAG AA geprüft (Text ≥ 4.5:1 auf `--paper`, `--sheet` und `--sheet-raised`).

| Variable | Hell | Dunkel | Rolle |
|---|---|---|---|
| `--paper` | `#f3f4f1` | `#111617` | Seitenhintergrund, `themeColor` |
| `--sheet` | `#ffffff` | `#192022` | Panels, Inputs |
| `--sheet-raised` | `#e8ebe7` | `#222a2d` | Verschachteltes, Hover-Fläche, Spur von Balken |
| `--ink` | `#1b2326` | `#e6eceb` | Text (14.5:1 / 15.3:1) |
| `--ink-soft` | `#475256` | `#b1bdbb` | Meta, Untertitel (7.3:1 / 9.4:1) |
| `--ink-faint` | `#5f6a6c` | `#8f9c9a` | Platzhalter, Vergangenes (5.0:1 / 6.4:1) |
| `--royal` (Akzent) | `#0d6763` | `#7dcdc4` | Links, aktive Navigation, Primär-Button, Fokus |
| `--on-accent` | `#ffffff` | `#0b1f1d` | Text auf Akzentfläche |
| `--royal-wash` | `#dcefec` | `#1f3533` | Aktiv-/Auswahlfläche |
| `--green` / `--green-wash` | `#2a6f30` / `#e1f0e1` | `#86cf8f` / `#1d3322` | OK, läuft gerade, gelernt |
| `--amber` / `--marker` | `#8a5100` / `#fbe8c8` | `#e8b45c` / `#3a2e17` | Warnung, Raumänderung, Markierung |
| `--red` / `--red-wash` | `#b3261e` / `#f8e1de` | `#f2918a` / `#3a1f1d` | Überfällig, Fehler, Löschen |
| `--rule` | `#d5d9d4` | `#2c3538` | Trennlinien in Listen und Tabellen, Input-Rahmen |

- `--glow` und `--shadow` sind `none`. `--grid` und `--card-line` entfallen (`--card-line` = `--rule`).
- Akzent nur für: Primär-Button, Links, aktive Navigation, Fokus, Fortschritt. Nicht für Titel.
- Status nie nur über Farbe: immer Text dazu («überfällig», «Anderer Raum»).

---

## 4. Abstände, Radien, Flächen

**Raster 4/8 px.** Nur diese Werte für `padding`, `margin`, `gap`:

`--space-1` 4px · `--space-2` 8px · `--space-3` 12px · `--space-4` 16px · `--space-5` 24px · `--space-6` 32px · `--space-7` 48px · `--space-8` 64px

- Panel-Innenabstand `--space-5` (Handy `--space-4`), Abstand zwischen Panels `--space-5`, Seitenrand `--space-4` (Handy) bis `--space-6`.
- Ausnahmen nur für 1–2 px (Rahmen, Feinjustage von Icons).

**Radien:** `--radius-s` 4px (Buttons, Inputs, Chips), `--radius-m` 8px (Panels). Rund (50 %) nur für den Jarvis-Knopf, Avatar, Statuspunkt.

**Tiefe:** Flächen trennen sich durch Tonstufe (`--paper` → `--sheet` → `--sheet-raised`), nicht durch Schatten oder Rahmen. Schatten nur auf echtem Overlay (Handy-«Mehr»-Feld, Dialog): `0 8px 24px rgb(0 0 0 / .18)`.

**Linien:** 1 px `--rule` nur, wo sie Daten gliedern: Listenzeilen, Tabellen, Formularfelder, Kopfzeile unten.

---

## 5. Komponenten

- **Panel `.sheet` / `.panel`:** `--sheet`, Radius 8 px, kein Rahmen, kein Schatten, keine Eck-Deko, keine Einblende-Animation. Titel `.panel-title`: `--step-1`, 700, `--ink`, Satzschreibung.
- **Buttons:** `.btn` = `--sheet-raised`-Fläche, `--ink`, kein Rahmen; Hover: eine Tonstufe dunkler (`color-mix(in srgb, var(--sheet-raised), var(--ink) 8%)`). `.btn-primary` = `--royal`-Fläche, `--on-accent`; Hover 10 % dunkler. Kein Verblassen (`opacity`) beim Hover, kein Schimmer. Höchstens ein Primär-Button pro Ansicht. Disabled: Deckkraft 0.5 + `cursor: not-allowed`.
- **Formulare `.field`:** Input `--sheet`, 1 px `--rule`, Radius 4 px; `:focus-visible` = 2 px Ring `--royal`, Offset 2 px.
- **Kopfzeile:** `--paper`, 1 px `--rule` unten, kein Blur. Marke «Jarvis» als Text (Logo-Zeichen: statische Kapsel, keine Drehung). Uhrzeit `tabular-nums`, ohne Leuchten.
- **Navigation:** Desktop-Sidebar: Link `--ink-soft`; Hover `--sheet-raised`; aktiv `--royal-wash` + `--royal`, 700. Handy: feste Leiste unten (`--sheet`, Linie oben), «Mehr» öffnet Feld darüber.
- **«Als Nächstes» `.nextup`:** Fläche `--royal-wash` (läuft gerade: `--green-wash`), kein Linksbalken. Label «Als Nächstes» in Satzschreibung `--step--1`, 700.
- **Empfehlung `.tip`:** Zeile in `--sheet-raised`, Art als Wort («Hinweis», «Dringend», «Erledigt») statt Symbol, kein Linksbalken.
- **Stundenplan-Block `.slot`:** Fläche `--royal-wash`, kein Linksbalken.
- **Raumwarnung `.room-alert`:** Fläche `--marker`, Text `--amber` 700 «Anderer Raum», alter Raum durchgestrichen. Kein Pulsieren, kein Leuchten.
- **Zähler/Chips:** `--sheet-raised`, Radius 4 px, `--step--1`, `tabular-nums`.
- **Fortschritt:** `.bar` 8 px, Spur `--sheet-raised`, Füllung `--royal` (Reife: `--green`). Ring-Gauges (`RingGauge`) mit Spur `--sheet-raised`, Füllung `currentColor`, kein Leuchten.
- **Startseite Kopf:** grosse Uhrzeit (`--step-3`, `tabular-nums`) und Datum als Text, darunter Begrüssung. Kein Ring.
- **Jarvis-Knopf `.jarvis-fab`:** 52 px rund, `--royal`-Fläche, Mikrofon-Icon `--on-accent`, kein Leuchten.
- **Sprachbildschirm `/jarvis`:** gleicher Hintergrund wie die App. Statt Reaktor ein ruhiger Kreis (Mikrofon) mit Zustand als **Text** («Ich höre zu», «Ich denke nach», «Ich spreche»); Zustand zusätzlich über Farbe der Kreisfläche (hören: `--royal`, denken: `--sheet-raised`, sprechen: `--green`). Einzige Bewegung: sanftes Skalieren (transform) beim Hören, aus bei `prefers-reduced-motion`. Verlauf: Jarvis-Nachrichten auf `--sheet`, eigene auf `--royal-wash`, ohne Seitenrand.

---

## 6. Bewegung

- Nur Rückmeldung auf Bedienung: Hover-/Aktiv-Farbe (120 ms), Aufklappen des «Mehr»-Felds, Kartenumdrehen beim Lernen, Fortschrittsbalken (`transform: scaleX`).
- Keine Endlos-Animationen ausser Lade-/Abgleichzustand (Statuspunkt).
- Nur `transform` und `opacity` animieren. `prefers-reduced-motion: reduce` schaltet alles ab (globale Regel).

---

## 7. Sprache

- Deutsch, Schweizer Schreibung (ss), Datum/Zahlen `de-CH`.
- Kurze Sätze, Satzschreibung in Titeln und Buttons. Buttons sagen, was passiert («Termin speichern»).
- Keine Gedankenstriche als Satzverbinder; Punkt oder Komma. Für Spannen «9 bis 10 Uhr» oder `9–10` (Halbgeviertstrich nur bei Zahlenbereichen).
- Keine Werbewörter (smart, nahtlos, KI-gestützt, System, Mission, Cockpit).
- Fehlermeldungen nennen den nächsten Schritt.

---

## 8. Responsive

| Breite | Verhalten |
|---|---|
| ≤ 640 px | Handy: einspaltig, Navigation unten, Jarvis-Knopf über der Leiste, Panel-Innenabstand 16 px |
| 641–1099 px | Sidebar links, Inhalt einspaltig bis zweispaltig |
| ≥ 1100 px | Startseite dreispaltig |

- Touch-Ziele ≥ 44 px. `touch-action: manipulation` global. `env(safe-area-inset-*)` beachten.
- Kein horizontales Scrollen bei 390 px.

---

## 9. Kurzreferenz für Agenten

```
Schrift: Atkinson Hyperlegible Next (--font-ui), Mono nur Formeln (--font-mono)
Hell:  paper #f3f4f1  sheet #fff  raised #e8ebe7  ink #1b2326  soft #475256  akzent #0d6763
Dunkel: paper #111617 sheet #192022 raised #222a2d ink #e6eceb soft #b1bdbb akzent #7dcdc4
Abstände: 4 8 12 16 24 32 48 64 (--space-1…8)   Radien: 4 / 8
Verboten: glow, gradient, backdrop-filter, box-shadow in Ruhe, border-left als Farbbalken,
          uppercase + letter-spacing, Emoji, Endlos-Animation, Hex-Werte ausserhalb :root
```

Checks vor «fertig»: `npx tsc --noEmit` · `npx eslint . --max-warnings 0` · `npm run build` · bei Sprachassistent `npx tsx scripts/voice-check.ts` · Screenshots Handy 390 px und Laptop 1440 px, hell und dunkel, ohne Konsolen- oder CSP-Fehler.
