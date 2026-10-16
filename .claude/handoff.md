# Übergabe zwischen Sitzungen

Wird von `/close` gepflegt. Am Anfang jeder Sitzung lesen (siehe CLAUDE.md).

## Nächste Aufgabe

keine

## Offen

- Launch-Vorbereitung (nur Nutzer, README „Launch-Checkliste“): `supabase/schema.sql` + `supabase/push.sql` im SQL-Editor erneut ausführen (2FA-Regel, sonst schützt 2FA die Daten nicht); in Vercel `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_DATA_REGION` setzen; Supabase-Auth-Einstellungen (Passwortlänge 10, MFA, CAPTCHA, Redirect URLs); Vercel-Firewall-Rate-Limit für `/api/*`.
- 2FA-Ablauf und „Konto löschen“ sind nicht gegen echtes Supabase getestet (kein Schlüssel in der Cloud).
- `/nachbereitung` einmal echt ausprobieren: dafür `JARVIS_EMAIL`/`JARVIS_PASSWORD` in `.env.local` eintragen (Login und Schreiben nach Supabase sind ungetestet, nur `--dry-run` geprüft).
- Design (DESIGN.md §10) bewusst weggelassen: Sidebar-Icons, Mission-Timeline, Werkzeug-Kacheln, Desktop-Sprachleiste unten, Glocke/Suche in der Kopfzeile, Feed-Stil für Prüfungen/Raumwarnungen/Uni-Mail. Tablet-Breite 641–760 px mit Sidebar ist eng; alte `.topnav`-Regel für diese Breite ist wirkungslos.
- OpenRouter-Weg (Folientext via pdf.js) unter Node nicht testbar (`readPdf` lädt den Worker fest von `/pdf.worker.min.mjs`).
- Mobile Push für Claude-Benachrichtigungen ist in `/config` aus.

## Letzte Sitzungen

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

### 2026-10-15 – Cloud-Sitzung (vm, Sprachinterface)
- Neu: `/jarvis` Sprachbildschirm (Reaktor-Orb, Zustände hören/denken/sprechen), erscheint beim ersten Öffnen pro Browser-Sitzung (`sessionStorage` „jarvis-intro“, abschaltbar „Beim Start“). Mikrofon-Knopf auf allen Seiten.
- Gemini Function Calling: `chatTurn` in `gemini.ts` (gleiche Modellkette), Schleife `jarvisAgent.ts`, 18 Werkzeuge in `voiceTools.ts` (Termine, Aufgaben, Überblick, Lernstand, Lernzeit, Noten, Vorlesungen, Fokus, Seiten, Links). Spracherkennung/Stimme: `speech.ts` (Web Speech API, de-CH).
- Tests: `scripts/voice-check.ts` (Werkzeuge + simulierte Gesprächsrunde), Browser-Test mit simuliertem Mikrofon und Gemini (Handy + Desktop): Termin per Sprache landet im Kalender. Nutzer hat mit echtem Schlüssel getestet: „läuft alles“.
- Gebaut auf Branch `claude/voice-interface-r35y46`, PR #1, in `main` übernommen. Commits: `c5e7b4d` chatTurn, `9be3e46` Werkzeuge, `a8ce7ca` Sprachbildschirm, `dd8b717` Feinschliff.

### 2026-10-15 – PiravinLap2
- Plugins `ponytail` + `superpowers` im Projekt aktiviert (`.claude/settings.json`), graphify-Graph gebaut (`graphify-out/` ignoriert, pdf.js-Worker per `.graphifyignore` ausgeschlossen).
- Browser-Test aller 16 Seiten (Desktop + Handy) ohne Fehler; Fix: „Termine aus Text“ – mehrere Daten in einem Absatz bekommen eigene Uhrzeit/Titel/Art (`scripts/textdates-check.ts`).
- Neu: Folien automatisch aufbereiten ohne Claude-API (`src/lib/gemini.ts`): Kette Gemini 3.5 Flash → Flash-Lite → Flash (neuestes, langsam) → OpenRouter-Gratis (Nemotron, nur Folientext); Zeitlimit 3 Min.; Videos über YouTube-Data-API. Schlüssel (Gemini/OpenRouter/YouTube) pro Gerät im localStorage, eingetragen im Importer. Selbsttest `scripts/gemini-check.ts`.
- Echte Läufe: `gemini-flash-latest` (= 3.8) hängt im Gratis-Kontingent oft minutenlang, Gemini-Google-Suche ist im Gratis-Kontingent gesperrt (429) → deshalb YouTube-API. Komplettlauf zuletzt ~2 Min.
- Commits: `185ca36` Plugins, `86eac9e` graphify-Ignore, `397814b` Termine aus Text, `4ae2a25` Gemini-Automatik, `7495914` Ausweichkette + YouTube.
