# Übergabe zwischen Sitzungen

Wird von `/close` gepflegt. Am Anfang jeder Sitzung lesen (siehe CLAUDE.md).

## Nächste Aufgabe

**Nachbereitungsplan auf der Vercel-Vorschau von PR #5 testen, dann mergen.**
- Ziel: Prüfen, ob der Plan zu deinem echten Stundenplan passt (Rückstand der letzten 5 Wochen, Einheiten an freien Nachmittagen/Wochenende), dann PR #5 nach deinem OK in `main` übernehmen.
- Testen: `/lernplan` (Abschnitt „Nachbereitungsplan“, „Lernzeiten“, „Andere Zeit“, Abhaken pro Woche), `/kalender` (grüne Einheiten), Jarvis: „Wie viel muss ich noch nachbereiten?“, „Heute Nachmittag habe ich keine Zeit“, „Anatomie vom Montag ist erledigt“, Termin über eine Einheit legen → Hinweis „verschoben“ mit Vorschlägen; „Verlauf“ im Sprachbildschirm.
- Abnahme: Zahlen stimmen mit deinem Stundenplan, Lernzeiten passen (sonst unter „Lernzeiten“ ändern, z. B. Arbeit an festen Tagen als Serientermin eintragen), Verlauf bleibt nach Neuladen.
- Kein `/firma` nötig. Merge über das GitHub-Werkzeug mit ausdrücklichem OK (Direkt-Push auf main ist in der Cloud gesperrt).

## Offen

- Nachbereitungsplan (PR #5) nur mit Beispiel-Stundenplan getestet, nicht mit dem echten Abo und nicht mit echtem Supabase-Abgleich (Store `chats`, Markierungen). Hochladen einer alten PDF deckt die jüngste offene Lektion des Fachs ab, nicht zwingend die gemeinte (Zählung stimmt).
- Launch-Vorbereitung (nur Nutzer, README „Launch-Checkliste“): `supabase/schema.sql` + `supabase/push.sql` im SQL-Editor erneut ausführen (2FA-Regel, sonst schützt 2FA die Daten nicht); in Vercel `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_DATA_REGION` setzen; Supabase-Auth-Einstellungen (Passwortlänge 10, MFA, CAPTCHA, Redirect URLs); Vercel-Firewall-Rate-Limit für `/api/*`.
- 2FA-Ablauf und „Konto löschen“ sind nicht gegen echtes Supabase getestet (kein Schlüssel in der Cloud).
- `/nachbereitung` einmal echt ausprobieren: dafür `JARVIS_EMAIL`/`JARVIS_PASSWORD` in `.env.local` eintragen (Login und Schreiben nach Supabase sind ungetestet, nur `--dry-run` geprüft).
- Design (DESIGN.md §10) bewusst weggelassen: Sidebar-Icons, Mission-Timeline, Werkzeug-Kacheln, Desktop-Sprachleiste unten, Glocke/Suche in der Kopfzeile, Feed-Stil für Prüfungen/Raumwarnungen/Uni-Mail. Tablet-Breite 641–760 px mit Sidebar ist eng; alte `.topnav`-Regel für diese Breite ist wirkungslos.
- OpenRouter-Weg (Folientext via pdf.js) unter Node nicht testbar (`readPdf` lädt den Worker fest von `/pdf.worker.min.mjs`).
- Mobile Push für Claude-Benachrichtigungen ist in `/config` aus.
- Animationen (DESIGN.md §11) nur bei 390 px und 1440 px geprüft, nicht auf Tablet und nicht auf schwachen Handys (Partikel-Canvas, Wireframe, Hologramm-Schimmer). Bekannt: Checkbox-Ring läuft beim Laden auch bei schon erledigten Aufgaben; verschachtelte `.sheet` blenden doppelt ein.

## Letzte Sitzungen

### 2026-10-16 – Cloud-Sitzung (Nachbereitungsplan, Gedächtnis, Verlauf)
- Nachbereitungsplan `src/lib/prepPlan.ts`: alle nicht nachbereiteten Vorlesungen seit Semesterbeginn (frühester `slot.from`), Einheiten in freien Fenstern (werktags 13–20, Wochenende 10–17, 60 Min., Tagesmaximum), frische Vorlesungen am selben Tag zuerst. Wird nie gespeichert, immer neu gerechnet; Markierungen `prep-settings`, `prep-pin:<lektion>`, `prep-seen`, `nachbereitet:<lektion>`.
- Verschiebungen nach hinten (Termin oder verpasst) zeigt `PrepMoves` mit Grund + 3 Alternativen; ohne Verschiebung wird `prep-seen` still aktualisiert. Einheiten im Kalender, Startseite, .ics, Push (`prep`, 10 Min. vorher), Briefing.
- Sprache: `nachbereitung_plan/_erledigt/_verschieben`, `keine_zeit` (trägt Sperrtermin „Keine Zeit“ ein), `lernzeiten_einstellen`, `merken`/`vergessen` (Mark `jarvis-memory`, geht in den Systemtext); `termin_anlegen/_aendern` melden `ueberschneidungen` und `nachbereitung_verschoben`.
- Gespräche: neuer Store `chats` (IndexedDB v5, abgeglichen), „Verlauf“ im Sprachbildschirm, Fortsetzen unter 3 h, max. 50. Datenschutz ergänzt.
- Tests: tsc, lint, build, voice-check, neues `prep-check.ts`, Playwright 390/1440 ohne Fehler, Chat mit simuliertem Gemini. PR #5 (Branch `claude/nachbereitung-lernplan-9kmbv8`), Commit `14659f7`.

### 2026-10-16 – PiravinLap2 (/firma: Design, Animationen, Vorlesungs-Fix)
- Ruhiges helles «Laborjournal»-Design gebaut (`19f8b1b`), Nutzer wollte aber Jarvis/HUD/Futuristisch zurück: alte Design-Dateien wiederhergestellt, Verbesserungen behalten (Atkinson Hyperlegible Next für Fliesstext, 4/8-px-Raster `--space-*`, Skip-Link, `role=status/alert` im Konto, Texte ohne Gedankenstriche, de-CH). Regeln in DESIGN.md §11.
- Viele Animationen: driftendes Raster + Partikel-Netz (`Particles.tsx`), Hologramm-Panels, Scan-Linie, gestaffeltes Einrasten, Seitentitel-Decode (`PageTitleDecode.tsx`), Split-flap-Uhr (`SplitFlap.tsx`), Zahlen hochzählen (`CountUp.tsx`), Sekundenzeiger im HudRing, Orb mit Partikeln/Equalizer/Hochfahren, drehendes Paracetamol-Drahtgitter (`Wireframe.tsx`, /jarvis + /pharmazie). Alles aus bei reduced-motion.
- Vorlesung: «Titel und Fach ändern» springt zum Formular und fokussiert den Titel (`61cfcd4`).
- Stolperfalle: `.next` im OneDrive-Ordner → `EINVAL readlink`; Abhilfe `rm -rf .next`. Atkinson braucht `adjustFontFallback: false` (sonst Build-Warnung).
- Tests: tsc, lint, build, voice-check; Produktions-Build 17 Seiten ohne Konsolen-/CSP-Fehler, Screenshots in `.shots/` (ignoriert).

### 2026-10-16 – Cloud-Sitzung (vm, Sicherheit + Datenschutz aus zwei Reels)
- Reel 1 (Login-Sicherheit): CSP + Sicherheits-Header in `next.config.ts` (connect-src streng, neue externe Hosts dort eintragen), In-Memory-Rate-Limit `src/middleware.ts`, Passwortregeln + HIBP-Leak-Prüfung (`src/lib/password.ts`), „Passwort vergessen“, TOTP-2FA (`src/components/TwoFactor.tsx`) mit restriktiver RLS-Regel „2FA erzwingen“, `nachbereitung-save.ts --code=`.
- Reel 2 (Rechtliches): `/datenschutz` mit Betreiberangaben aus Vercel-Variablen, „Konto endgültig löschen“ (`/api/konto/loeschen`, braucht `SUPABASE_SECRET_KEY`), Launch-Checkliste im README. Kein Cookie-Banner nötig (kein Tracking).
- Nutzer will die App evtl. für Kommilitonen öffnen: nicht mehr als privat behandeln. env-Dateien + Git-Historie geprüft: nur öffentliche Werte.
- Design-Fix Handy: Empfehlungen (`.tip`) umbrechen statt die Seite zu verbreitern; Kopfzeile mit `safe-area-inset-top`.
- Tests: tsc, lint, build, voice-check, Playwright 18 Seiten × Handy/Laptop ohne Konsolen-/CSP-Fehler. PR #3, Commits `7d550b2`, `9445074`, `08cd5ab`.

### 2026-10-15 – PiravinLap2 (/firma: Echttest, /nachbereitung, Design)
- Echttest mit langer PDF (Anatomie ZNS I, 12 MB) über `scripts/lecture-check.ts` (Modell erzwingen, Dauer, Schema, finishReason): 3.5 Flash Notizen 67 s / 6 Abschnitte, danach 429 beim Lernmaterial (Kontingent; App fällt auf Flash-Lite zurück); Flash-Lite Notizen+Lernmaterial je ~28 s, 15 Karten/15 Fragen. Kein abgeschnittenes JSON (finishReason STOP). YouTube-Videosuche echt getestet: 3 passende Videos.
- Skill `/nachbereitung <pdf>` + `scripts/nachbereitung-save.ts` (Zod-Prüfung, `--dry-run`, `--courses`, Login E-Mail/Passwort aus `.env.local`, schreibt `sync_items` wie `sync.ts`). Importer/db nutzen dafür gemeinsames `src/lib/lectureRecords.ts`.
- DESIGN.md §10 Schritte 1–6: Panel-Titel/Feed-Badges, `RingGauge`/Lernmonitor (Start + Statistik), Kopfzeile mit Uhr + Profil-Pille (`TopbarInfo`), Startseite 3 Spalten ab 1100 px, Desktop-Sidebar ab 641 px mit Aufgaben-Zähler, Systemübersicht + KI-Status (`SystemStatus`).
- Browser-Test (Playwright, 16 Seiten × Handy/Tablet/Laptop): keine Konsolenfehler, kein horizontales Scrollen; Fix: Hero-Spalte war 320 px zu hoch, Ringe in einer Reihe.

### 2026-10-15 – Cloud-Sitzung (vm, Serientermine + Begrüssung)
- Kalender: wöchentliche Serien (`CalEvent.repeat`, entfaltet in `occurrences()` in `planner.ts`, Schlüssel `event:<id>:<datum>`), im Editor „Jede Woche wiederholen“ + „bis“; per Sprache `termin_anlegen` mit `woechentlich`/`wiederholen_bis`. Löschen/Ändern trifft immer die ganze Serie (`skip` existiert im Typ, wird aber noch nirgends gesetzt).
- Jarvis begrüsst beim Öffnen mit Vornamen (Profil in „Konto“), Tagesprogramm und bald fälligen Aufgaben (`src/lib/briefing.ts`, ohne KI-Aufruf). Vorlesen erst nach erster Berührung (Browser-Regel); erstes Tippen auf den Reaktor: Begrüssung, danach zuhören.
- Stimme: männliche, „Natural/Online“-Stimmen bevorzugt (`speech.ts`), sonst tiefere Tonlage. Name geht auch in den Systemtext.
- Tests: `voice-check.ts` (Serien inkl. Zeitumstellung, Begrüssung), Browser-Test mit simuliertem Mikrofon/Gemini.
- Commit: `15bc0d5`.
