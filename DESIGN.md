# DESIGN.md – Jarvis Uni-Cockpit

> Design-System für KI-Agenten (Claude Code, Cursor, Google Stitch). Zielbild: der Look des «JARVIS Command Center»-Referenzbilds (dunkles Sci-Fi-HUD, Cyan-Glow, dichte Panels, Sidebar, Hero-Kern, Sprachleiste), **übertragen auf die bestehende App** (Next.js 15, Studium Pharmazeutische Wissenschaften, Uni Basel).
>
> **Grundregel:** Die vorhandenen Tokens und Klassen in `src/app/globals.css` und `src/app/cockpit.css` sind die Wahrheit. Neues Design wird daraus aufgebaut, nicht daneben. Abschnitt 10 zeigt, was sich gegenüber heute ändert.

---

## 1. Visual Theme & Atmosphere

- **Idee:** Ein persönliches Kommandozentrum für den Studienalltag. Dunkles Blauschwarz, Cyan als Leuchtfarbe, Bernstein als zweiter Akzent. Alles wirkt, als leuchte es aus der Tiefe.
- **Stimmung:** technisch, ruhig, cineastisch (Iron-Man-Jarvis), aber nützlich: jede Karte zeigt echte Studiendaten.
- **Dichte:** mittel bis hoch am Desktop (mehrere Panels nebeneinander wie im Referenzbild), auf dem Handy einspaltig und luftiger.
- **Licht statt Fläche:** Tiefe entsteht durch Glow, Konturen und Verläufe, nie durch helle Flächen. Hell leuchten nur: Uhrzeit, Jarvis-Kern, aktive Zustände, Primär-Button.
- **Hintergrund:** Blaupausen-Raster (24 px, sehr schwach) plus weiches Cyan-Leuchten von oben (`body`-Hintergrund in `globals.css`).
- **Panel-Charakter:** Jedes Panel (`.sheet`) trägt kurze hellere **HUD-Ecken-Klammern**, die beim Laden einrasten (`hud-lock`). Das ist das wichtigste Wiedererkennungsmerkmal und bleibt.
- **Sprache der App:** Deutsch, Zahlen und Daten im Format `de-CH`.

---

## 2. Color Palette & Roles

Alle Farben existieren bereits als CSS-Variablen in `:root` (`globals.css`). **Immer die Variable verwenden, nie den Hex-Wert.**

### Flächen
| Variable | Wert | Rolle |
|---|---|---|
| `--paper` | `#050f1b` | App-Hintergrund, auch `themeColor` |
| `--sheet` | `#0b1d2e` | Panels, Inputs, Buttons, Handy-Leiste |
| `--sheet-raised` | `#0f2639` | Verschachtelte/erhöhte Elemente, Mikrofon-Knopf |
| `--grid` | `rgba(70,213,245,0.05)` | Hintergrund-Raster, leere Heatmap-Zellen |
| Panel-Verlauf | `rgba(15,38,57,.92)` → `rgba(9,26,41,.92)` | Fläche von `.sheet` |
| Sprachbildschirm | `radial #0c2a40 → --paper` | Hintergrund von `/jarvis` |

### Text
| Variable | Wert | Rolle |
|---|---|---|
| `--ink` | `#dcf3ff` | Haupttext, Titel |
| `--ink-soft` | `#98bbd0` | Untertitel, Metadaten, Nav-Links |
| `--ink-faint` | `#6f93ab` | Platzhalter, deaktiviert, «geprüft um…» |

### Akzente (`--royal` heisst so aus Altlast, ist das Cyan)
| Variable | Wert | Rolle |
|---|---|---|
| `--royal` | `#46d5f5` | **Primärfarbe:** Titel, Icons, aktive Nav, Ringe, Fokus, Links, Neu-Zähler |
| `--royal-wash` | `rgba(70,213,245,.12)` | Hover-/Aktiv-Hintergrund, Bars-Spur |
| `--glow` | `0 0 18px rgba(70,213,245,.35)` | Standard-Leuchten (Primär-Button, Tags, FAB) |
| `--amber` | `#f2b13d` | **Zweiter Akzent:** Warnung, Raumänderung, Aktion, Fokus-Fenster |
| `--marker` | `rgba(242,177,61,.32)` | Hervorhebung/Markierung |

### Status
| Variable | Wert | Rolle |
|---|---|---|
| `--green` / `--green-wash` | `#3fe0a6` | OK, Live, gelernt/Reife, Wiederholung fällig, Sync «bereit» |
| `--red` / `--red-wash` | `#ff6b7a` | Überfällig, Fehler, Lernen-Zähler, Löschen |
| `--amber` | siehe oben | Warnung, Raum fehlt/geändert |

### Linien & Schatten
| Variable | Wert | Rolle |
|---|---|---|
| `--rule` | `rgba(70,213,245,.16)` | Standard-Rahmen und Trennlinien |
| `--card-line` | `rgba(70,213,245,.3)` | Stärkere Konturen (Tags, Chips, Inputs im Sprachbildschirm) |
| `--shadow` | `0 0 0 1px rgba(70,213,245,.04), 0 14px 32px -18px rgba(0,0,0,.9)` | Panel-Schatten |

> **Hinweis zum Referenzbild:** Dort kommen zusätzlich Violett und Orange als Kategorie-Farben vor. In der App gibt es sie nicht. Wer Kategorien (z. B. Fächer) farblich trennen will, nimmt **Cyan, Grün, Bernstein, Rot** und Abstufungen davon. Neue Farben nur auf ausdrücklichen Wunsch einführen und dann als Variable in `:root` anlegen.

---

## 3. Typography Rules

**Schriften** (in `layout.tsx` über `next/font/google` geladen):
- `--font-hud` = **Chakra Petch** (500/600/700): Marke, Überschriften, Navigation, Tags, grosse Zahlen, Uhrzeit.
- `--font-ui` = **Hanken Grotesk**: Fliesstext, Formulare, Beschreibungen.
- Monospace (`ui-monospace, Consolas`) nur für Formeln/Code (Pharmazie-Rechner).

**Skala** (`--step-*`): `-1` 0.875rem · `0` 1rem · `1` 1.1875rem · `2` 1.5rem · `3` 2.125rem · `4` 3rem.

| Rolle | Stil |
|---|---|
| Marke «JARVIS» (Kopfzeile) | HUD, 600, `--step-1`, **Grossbuchstaben**, Letter-spacing `0.22em` |
| Hero «JARVIS» (Sprachbildschirm) | HUD, 600, `clamp(1.5rem, 6vw, 2.2rem)`, Letter-spacing `0.32em`, `--royal`, `--glow` |
| Seitentitel `.page-title` | HUD, 600, `clamp(2rem, 5vw, --step-4)` |
| Panel-Titel `.panel-title` | HUD, `--step-1`. **Ziel:** wie im Referenzbild kleiner, Grossbuchstaben, Letter-spacing ~`0.12em`, `--royal` |
| Uhrzeit `.hud-time` | HUD, 600, `clamp(2.2rem, 9vw, 3.1rem)`, `tabular-nums`, Letter-spacing `0.06em`, Text-Glow `rgba(70,213,245,.7)` |
| Label «Als Nächstes» `.nextup-label` | 700, `--step--1`, Grossbuchstaben, Letter-spacing `0.06em`, `--royal` (grün bei live) |
| Grosse Zahlen `.big-number`, `.score` | HUD, 600, `--step-4`, `tabular-nums` |
| Navigation | HUD, 500, Letter-spacing `0.03em`, aktiv `--royal` + Text-Glow |
| Lead `.lede` | `--ink-soft`, max. `60ch` |
| Meta/Klein `.small`, `.muted` | `--step--1`, `--ink-soft` |

Zahlen, die sich ändern (Zeiten, Zähler, Countdowns), immer mit `font-variant-numeric: tabular-nums`.

---

## 4. Component Stylings

### 4.1 Panel `.sheet` (+ `.panel`)
- Verlauf-Fläche, 1 px `--rule`, Radius `--radius-m` (6 px), `--shadow`.
- `::before` zeichnet die vier HUD-Eck-Klammern (14 px, 1.5 px, `rgba(70,213,245,.75)`); bei Hover Voll-Cyan + Drop-Glow. Animation `hud-lock` (0.55 s).
- `.panel`: Innenabstand `clamp(18px, 3vw, 26px)`. Titel `.panel-title`, Fusslink `.panel-more` («Alle anzeigen ›»-Stil, `--royal`, 600, `--step--1`).

### 4.2 Kopfzeile `.topbar`
- Sticky, `rgba(5,15,27,.96)`, 1 px `--rule` unten, **bewusst ohne `backdrop-filter`** (würde die feste Handy-Leiste einsperren).
- Links Marke (`HudMark` mit drehendem Cyan-Ring und Bernstein-Bogen + «JARVIS»), dann `SyncBadge`, rechts Navigation.
- **Ziel (Referenzbild):** in der Kopfzeile zusätzlich Datum + Uhrzeit mittig und Sync-Status als «System-Status»-Pille (siehe 10).

### 4.3 Navigation `.topnav`
- Desktop: alle Seiten in einer Zeile. Link: `--ink-soft`, Radius 4 px. Hover: `--royal-wash`. Aktiv (`aria-current="page"`): `--royal`, `--royal-wash`, innerer Cyan-Balken unten (`inset 0 -2px`), Text-Glow.
- Handy (≤ 640 px): feste Leiste unten (`--sheet`), 4 Hauptseiten + «Mehr»; «Mehr» öffnet ein 2-spaltiges Feld über der Leiste (`nav-sheet-in`).
- Seiten: Heute, Aufgaben, Stundenplan, Lernplan | Kalender, Vorlesungen, Lernen, Fokus, Studium, Pharmazie, Links, Karten, Statistik, Konto (nur Handy).

### 4.4 Buttons
- `.btn`: 1.5 px Rahmen `--ink`, `--sheet`, 600, Radius 4 px; Hover `--royal-wash`.
- `.btn-primary`: `--royal`-Fläche, Text `#04121f`, `--glow`, Lichtreflex-Schimmer beim Hover. **Pro Ansicht höchstens ein Primär-Button.**
- `.btn-quiet`: transparent, `--ink-soft`. `.btn-danger`: `--red`, Hover `--red-wash`.
- Disabled: Deckkraft 0.45.

### 4.5 Tags, Pillen, Kacheln
- `.hud-tag`: 1 px `--card-line`, HUD-Schrift 600; `.is-level` = Cyan-Fläche mit Glow; `.is-action` = Bernstein-Kontur.
- `.pill`: runde Pille, `--royal-wash`, `--ink-soft`. `.live-pill`: grün. 
- `.tile` (Schnellzugriff `.quick-tiles`): Pille (99 px), `--sheet`, 1 px `--rule`; Hover Cyan.
- `.sync-badge` mit `.sync-dot`: grün = bereit, Cyan pulsierend = Abgleich, rot = Fehler.

### 4.6 Formulare `.field`
- Label 600 `--step--1`; Input/Textarea/Select: `--sheet`, 1.5 px `--rule`, Radius 4 px; Fokus: Rand `--royal`. Globaler Fokus-Ring: 2.5 px `--royal`, Offset 2 px.

### 4.7 «Als Nächstes» `.nextup`
- Panel mit 6 px Linksbalken `--royal` (grün bei `.is-live`). Titel gross, darunter Art und Raum. Raumänderung als `.room-alert` (siehe 4.9).

### 4.8 HUD-Ring `HudRing` und Fortschritt
- `HudRing` (`src/components/HudRing.tsx`): Skalenring, 36 Cyan-Segmente (74 % gefüllt), Bernstein-Bogen, Kern mit Radar-Schweif. Inhalt (Uhrzeit) liegt in `.hud-ring-center`. Beim Start einmal pro Sitzung «Hochfahren» (`is-boot`), danach nur langsame Drehungen.
- `.bar` (8 px, rund, `--royal-wash` Spur, `--royal` Füllung); `.mastery .bar > span` grün.
- Heatmap `.heat`: 5 Stufen aus `--grid` bis `--royal`.
- **Ziel (Referenzbild «System Monitor»):** kleine Ring-Gauges (SVG, Ø ~56 px, Strich 5 px, Spur `rgba(70,213,245,.15)`, Füllung `--royal` mit Glow) für Lernstand, Lernzeit heute, Aufgaben erledigt.

### 4.9 Raumwarnung `.room-alert`
- Bernstein: Fläche `rgba(242,177,61,.14)`, 1.5 px `--amber`, doppelter Glow, `room-pulse` (3×). Label «Anderer Raum!» in Grossbuchstaben, üblicher Raum durchgestrichen daneben. `.room-missing` = Bernstein, `.room-unknown` = `--ink-faint`.

### 4.10 Listen (Aufgaben, Termine, Prüfungen)
- Zeilen mit 1 px `--rule` als Trenner, Titel 600, Meta `--ink-soft`, Überfälliges in `--red`. Zähler `.counts`: `.c-new` Cyan, `.c-learn` Rot, `.c-review` Grün, `.c-zero` `--ink-faint`.
- Karteikarten (`.index-card`, `.flip`), Bewertung `.rate-1…4` (Nochmal/Schwer/Gut/Einfach).

### 4.11 Jarvis-Sprachbildschirm `/jarvis`
- Vollbild (`position: fixed`), Topbar ausgeblendet. **Reaktor-Orb** (`.jv-orb`, SVG mit Ringen `.jv-r1…r4`, Kern `.jv-core`), Zustände über `data-state`: `listening` (schneller, Ripple), `thinking` (Scan-Linie), `speaking` (pulsierender Kern).
- Verlauf `.jv-msg` (Jarvis: Cyan-Linksrand; Nutzer: Bernstein-Rechtsrand), Aktionen `.jv-action` (grün), Chips `.jv-chip`, Eingabe `.jv-row`, Mikrofon `.jv-mic`.
- Schwebender Knopf `.jarvis-fab`: 52 px rund, Cyan-Rand, `--glow`, unten rechts (auf dem Handy über der Leiste); auf `/jarvis` selbst ausgeblendet.

### 4.12 Weitere Seitenmodule
- Fokus (`fokus.css`), Pharmazie (`pharmazie.css`, Rechner/Pflanzen/Substanzen), Studium (`studium.css`), Teilen (`teilen.css`): Seiten-CSS liegt neben `page.tsx` und wird dort importiert. Gleiche Tokens, keine eigenen Farben.

---

## 5. Layout Principles

- **Seitenbreite:** `.page` max. **1180 px**, mittig; Seitenrand `clamp(16px, 4vw, 40px)`, oben `clamp(24px, 5vw, 56px)`, unten 96 px (Handy: `84px + safe-area` wegen Leiste).
- **Seitenkopf:** `.page-head` (Titel links, Aktionen rechts, 32 px Abstand nach unten).
- **Raster Startseite:** `.cockpit-grid` = `repeat(auto-fit, minmax(min(100%, 340px), 1fr))`, Abstand **20 px**.
- **Spacing:** 4 · 8 · 12 · 16 · 20 · 24 · 32 px; Panel-Abstand 20 px, innerer Abstand `clamp(18px, 3vw, 26px)`.
- **Radien:** `--radius-s` 4 px (Buttons, Inputs, Nav), `--radius-m` 6 px (Panels), 99 px (Pillen, Kacheln, Chips), 50 % (FAB).
- **Ziel-Anordnung Startseite «Heute»** (Desktop, angelehnt ans Referenzbild, 3 Spalten):
  - **Mitte oben:** Hero mit `HudRing` (Uhrzeit, Wochentag) und Status-Tags, darunter «Als Nächstes».
  - **Links:** Aufgaben, Lernplan heute.
  - **Rechts:** Kalender/Heute-Termine, «Jarvis empfiehlt», Prüfungen und Fristen.
  - **Unten:** Uni-Mail, Schnellzugriff-Kacheln, Sprachleiste (siehe 10).
- Titel linksbündig, Kennzahlen und Hero zentriert.

---

## 6. Depth & Elevation

| Ebene | Behandlung |
|---|---|
| 0 Hintergrund | `--paper` + Raster + Cyan-Aufhellung oben |
| 1 Panel | `.sheet`: Verlauf, 1 px `--rule`, `--shadow`, HUD-Ecken |
| 2 Hover/aktiv | Ecken voll Cyan + Drop-Glow, Rand `--royal` |
| 3 Primäraktion | `--glow`, Schimmer (Primär-Button), FAB mit Glow |
| 4 Overlay | Handy-«Mehr»-Feld: `--sheet`, Schatten `0 -10px 24px -12px rgba(0,0,0,.8)` |

Schatten sind tief und dunkel, Leuchten ist immer **Cyan** (Bernstein nur für Warnungen).

---

## 7. Do's and Don'ts

**Do**
- Immer CSS-Variablen aus `:root` nutzen; neue Werte dort ergänzen.
- Bestehende Klassen wiederverwenden (`.sheet`, `.panel`, `.btn*`, `.tile`, `.hud-tag`, `.field`, `.bar`).
- Statusfarben konsequent: Grün = ok/live, Bernstein = Warnung/Raum, Rot = überfällig/Fehler, Cyan = Primär/Neu.
- Status nie nur über Farbe zeigen (zusätzlich Text, Punkt oder Icon).
- Animationen nur mit Rücksicht auf `prefers-reduced-motion` (globale Regel in `globals.css` greift).
- UI-Texte auf Deutsch, Datum/Zahl `de-CH`.
- Kleinste Änderung, die die Aufgabe löst (Projektregel «Ponytail»); bewusste Abkürzungen mit `// shortcut:` markieren.

**Don't**
- Keine weissen/hellen Flächen, kein Light-Theme (`color-scheme: dark`).
- Kein `backdrop-filter` auf der Kopfzeile.
- Keine neuen Farben, Schriften oder UI-Bibliotheken ohne Rückfrage.
- Kein Glow auf Fliesstext (nur Titel, Uhrzeit, Kennzahlen, aktive Nav).
- Nicht mehrere Primär-Buttons pro Ansicht.
- Keine harten schwarzen Drop-Shadows als Dekor, keine runden/verspielten Formen, keine Serifen.
- Keine bezahlten KI-APIs (auch nicht Claude-API); KI-Funktionen laufen über die Gratis-Kette in `src/lib/gemini.ts`.
- Hex-Werte nicht in CSS kopieren (Ausnahme: SVG-Konstanten `C`/`AMBER` in `HudRing.tsx`).

---

## 8. Responsive Behavior

| Breakpoint | Verhalten |
|---|---|
| > 900 px | Volles Raster, `.browser` zweispaltig (1.4fr / 1fr) |
| ≤ 900 px | `.browser` einspaltig |
| ≤ 720 px | Deck-Liste zweispaltig → Reife-Balken eigene Zeile |
| ≤ 640 px | **Handy-Modus:** Nav als feste Leiste unten, «Mehr»-Feld, `.jarvis-fab` über der Leiste, `.hud-ring` 220 px, Sync-Label ausgeblendet, Tastenkürzel-Hinweise `.kbd` aus |
| ≤ 520 px | Termin-Zeilen `.occ` stapeln sich |

- Touch-Ziele mindestens ~44 px (Nav-Links 12 px Padding, FAB 52 px).
- `env(safe-area-inset-*)` für Leiste, Sprachbildschirm und FAB beachten.
- `@media (hover: none)`: Hover-Hinweise und Tastenkürzel ausblenden.
- Die App ist als PWA installierbar (Android/Windows); `themeColor` `#050f1b`.

---

## 9. Agent Prompt Guide

### Farb-Kurzreferenz
```
--paper #050f1b   --sheet #0b1d2e   --sheet-raised #0f2639
--ink #dcf3ff     --ink-soft #98bbd0   --ink-faint #6f93ab
--royal (Cyan) #46d5f5   --amber #f2b13d
--green #3fe0a6   --red #ff6b7a
--rule rgba(70,213,245,.16)   --card-line rgba(70,213,245,.3)
--glow 0 0 18px rgba(70,213,245,.35)
Schriften: Chakra Petch (--font-hud), Hanken Grotesk (--font-ui)
```

### Fertige Prompts
1. **Neue Seite:**
   «Lege die Seite `/xyz` an (`src/app/xyz/page.tsx`, CSS in `xyz/xyz.css`, dort importieren). Nutze `.page-head`, `.page-title`, `.lede`, `.cockpit-grid` mit `.sheet.panel`-Karten und nur Tokens aus DESIGN.md. Texte auf Deutsch.»
2. **Panel im Referenzstil:**
   «Baue ein Panel für ‹Lernstand› im Stil der DESIGN.md: `.sheet.panel`, Titel in Grossbuchstaben mit Letter-spacing, drei Ring-Gauges (Lernstand, Lernzeit, Aufgaben) mit Cyan-Glow, `tabular-nums`.»
3. **Startseite umbauen:**
   «Baue die Startseite `src/app/page.tsx` nach Abschnitt 5 (‹Ziel-Anordnung›) um: Hero mit `HudRing` in der Mitte, Aufgaben/Lernplan links, Termine/Empfehlungen/Fristen rechts. Bestehende Daten und Logik unverändert lassen.»
4. **Desktop-Sidebar:**
   «Ersetze am Desktop (> 640 px) die Zeilen-Navigation durch eine linke Sidebar nach Abschnitt 10; auf dem Handy bleibt die Leiste unten unverändert. Gleiche Links wie in `MainNav.tsx`.»
5. **Komponente:**
   «Erstelle eine Status-Pille ‹Alles bereit› mit grünem Punkt in der Kopfzeile, Verhalten wie `.sync-badge`.»

### Checks vor ‹fertig›
`npx tsc --noEmit` · `npx eslint . --max-warnings 0` · `npm run build` (es gibt keine automatischen Tests; Sprachassistent: `npx tsx scripts/voice-check.ts`).

---

## 10. Referenzbild → Jarvis: Abgleich und Ziel-Änderungen

Das Referenzbild zeigt ein generisches «KI-Kommandozentrum». Jedes Modul wird auf eine **bereits vorhandene Funktion** der App abgebildet. Was keine Entsprechung hat, entfällt.

| Referenzbild | In Jarvis | Quelle / Stand |
|---|---|---|
| Sidebar links (Command Center, Agents, Tasks, Calendar, Memory …) | Desktop-Sidebar mit den echten Seiten: Heute, Aufgaben, Stundenplan, Lernplan, Kalender, Vorlesungen, Lernen, Fokus, Studium, Pharmazie, Links, Karten, Statistik, Konto; Zähler-Pillen z. B. bei Aufgaben | **neu** (heute: Zeilen-Nav, `MainNav.tsx`) |
| Top-Bar: System-Status, Datum + Uhrzeit, Suche, Glocke, Profil | System-Status = `SyncBadge` (Abgleich/Push), Uhrzeit/Datum mittig, Profil-Pille mit Vorname aus «Konto»; Glocke → Push-Einstellungen | teils neu |
| Hero «JARVIS AI Core» (Kugel mit Orbit-Ringen) | `HudRing` mit Uhrzeit/Wochentag auf der Startseite; Orb auf `/jarvis` | vorhanden |
| AI Core Overview (Core, Memory, Voice, Agents, LLMs, System) | **Systemübersicht:** Sync, Push, Stimme/Spracherkennung, Gemini-Kette (aktives Modell), Schlüssel gesetzt ja/nein | neu, Daten vorhanden (`gemini.ts`, `speech.ts`, `sync.ts`, `push.ts`) |
| Live Intelligence Feed | «Jarvis empfiehlt», Prüfungen und Fristen, Raumwarnungen, Uni-Mail (`feeds.ts`, `news.ts`) | vorhanden, Stil angleichen (Icon links, Badge rechts: INFO/WARN/TIP) |
| Active Agents (Coding/Research/Memory …) | **Entfällt** als Agenten. Ersatz: «Werkzeuge» von Jarvis (Termine, Aufgaben, Lernstand, Fokus …, `voiceTools.ts`) als Kachelraster | optional |
| Mission Timeline | Tagesverlauf/«Als Nächstes» mit Zeit links, Punkt auf Linie, Status «in 42 Min» (Stundenplan + Termine, Räume live) | vorhanden, Darstellung neu |
| Quick Commands | `.quick-tiles` (Neue Aufgabe, Kalender, Fokus starten, Sprachchat) | vorhanden |
| System Monitor (CPU/RAM/Disk) | **Lernmonitor:** Ring-Gauges für Lernstand, Lernzeit heute, erledigte Aufgaben (`focus.ts`, `srs.ts`, Statistik) | neu |
| Memory Insights (Konstellation, Memories) | Karteikarten-Überblick: fällig heute, Neu/Lernen/Wiederholen (`.counts`), Reife-Balken pro Deck, Heatmap | vorhanden, Stil angleichen |
| LLM Status (Claude, OpenAI, Gemini …) | **KI-Status:** nur die echte Kette – Gemini 3.5 Flash → Flash-Lite → Flash → OpenRouter, YouTube-Schlüssel; je «Verbunden / Nicht gesetzt» | neu, bezahlte APIs bleiben ausgeschlossen |
| Bottom-Bar «Talk to JARVIS», Standort/Wetter/Netz | Sprachleiste unten (Desktop) bzw. `.jarvis-fab` (Handy) mit «Mit Jarvis sprechen»; Chips: Sync, Push; **kein** Wetter/Standort | FAB vorhanden, Leiste neu |
| «Executive Briefing»-Button | «Tagesbriefing» (Begrüssung mit Tagesprogramm aus `briefing.ts`) | vorhanden |

### Umsetzungsreihenfolge (kleinste Schritte, jeweils lauffähig)
1. Panel-Titel im Referenzstil (Grossbuchstaben, Letter-spacing) und Feed-Zeilen mit Icon + Badge – reine CSS-Änderung.
2. Ring-Gauges als wiederverwendbare Komponente (`src/components/`), Einbau in Statistik und Startseite.
3. Kopfzeile: Datum/Uhrzeit mittig, Profil-Pille.
4. Startseite in die 3-Spalten-Anordnung (Abschnitt 5).
5. Desktop-Sidebar (nur > 640 px); Handy-Leiste bleibt.
6. Systemübersicht und KI-Status als neue Panels.

Jeder Schritt: Checks aus Abschnitt 9, dann Commit auf Deutsch im Format `Bereich: was gemacht wurde`.
