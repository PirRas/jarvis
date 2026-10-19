# Übergabe zwischen Sitzungen

Wird von `/close` gepflegt. Am Anfang jeder Sitzung lesen (siehe CLAUDE.md).

## Nächste Aufgabe

Schnelleren Sprachchat (PR #8) im Alltag prüfen: auf dem Handy (App und Browser) und am Laptop ein paar typische Bitten sprechen («Was steht heute an?», «Trag morgen um 14 Uhr … ein», «Verschieb den Termin …»). Abnahme: Jarvis beginnt nach wenigen Sekunden zu sprechen, trägt korrekt ein, trennt Sätze sauber (keine Pausen mitten in «20. Oktober» oder «Prof. Meier»). Wenn zu dumm: in `src/lib/gemini.ts` bei `VOICE_MODELS` `thinking` von `low` auf `medium` stellen; wenn noch zu langsam: Flash-Lite (`minimal`) an die erste Stelle. Nächster grosser Schritt wäre die Gemini Live API (Audio direkt per WebSocket, eigene Google-Stimme, Unterbrechen mitten im Satz); dafür `superpowers:brainstorming`, Android-Mikrofon über native.ts klären.

Danach (nur am Laptop): Android-Signierschlüssel einrichten: `git pull`, dann `scripts/android-keystore.sh` ausführen (Passwort mind. 12 Zeichen, im Passwortmanager sichern). Das Skript setzt die vier Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` per `gh` (vorher `gh auth login`), sonst von Hand in GitHub → Settings → Secrets → Actions. Danach Workflow «Android-App» auf `main` von Hand starten, prüfen, dass der Lauf ohne Test-Schlüssel-Warnung signiert, alte App einmal deinstallieren und die neue `jarvis.apk` aus dem Release `android-latest` installieren. Details: `ANDROID.md` → «Signierschlüssel einrichten».

## Offen

- Android-App (PR #6, `ANDROID.md`): 2026-10-16 vom Nutzer auf dem Handy getestet, «funktioniert soweit alles». Nicht einzeln bestätigt: Erinnerungen bei geschlossener App, Fokus-Meldung, .ics teilen.
- Android-Signierschlüssel fehlt (siehe Nächste Aufgabe). Bis dahin hat jede APK einen anderen Test-Schlüssel (Update nur nach Deinstallation).
- Vor Launch der App: eigene Domain statt `nachbereitung.vercel.app` (App vertraut der Adresse vollständig), Vercel-Projekt nie umbenennen/löschen.

- Nachbereitungsplan (PR #5) nur mit Beispiel-Stundenplan getestet, nicht mit dem echten Abo und nicht mit echtem Supabase-Abgleich (Store `chats`, Markierungen). Hochladen einer alten PDF deckt die jüngste offene Lektion des Fachs ab, nicht zwingend die gemeinte (Zählung stimmt).
- Launch-Vorbereitung (nur Nutzer, README „Launch-Checkliste“): `supabase/schema.sql` + `supabase/push.sql` im SQL-Editor erneut ausführen (2FA-Regel, sonst schützt 2FA die Daten nicht); in Vercel `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_DATA_REGION` setzen; Supabase-Auth-Einstellungen (Passwortlänge 10, MFA, CAPTCHA, Redirect URLs); Vercel-Firewall-Rate-Limit für `/api/*`.
- 2FA-Ablauf und „Konto löschen“ sind nicht gegen echtes Supabase getestet (kein Schlüssel in der Cloud).
- `/nachbereitung` einmal echt ausprobieren: dafür `JARVIS_EMAIL`/`JARVIS_PASSWORD` in `.env.local` eintragen (Login und Schreiben nach Supabase sind ungetestet, nur `--dry-run` geprüft).
- Design (DESIGN.md §10) bewusst weggelassen: Sidebar-Icons, Mission-Timeline, Werkzeug-Kacheln, Desktop-Sprachleiste unten, Glocke/Suche in der Kopfzeile, Feed-Stil für Prüfungen/Raumwarnungen/Uni-Mail. Tablet-Breite 641–760 px mit Sidebar ist eng; alte `.topnav`-Regel für diese Breite ist wirkungslos.
- OpenRouter-Weg (Folientext via pdf.js) unter Node nicht testbar (`readPdf` lädt den Worker fest von `/pdf.worker.min.mjs`).
- Mobile Push für Claude-Benachrichtigungen ist in `/config` aus.
- Animationen (DESIGN.md §11) nur bei 390 px und 1440 px geprüft, nicht auf Tablet und nicht auf schwachen Handys (Partikel-Canvas, Wireframe, Hologramm-Schimmer). Bekannt: Checkbox-Ring läuft beim Laden auch bei schon erledigten Aufgaben; verschachtelte `.sheet` blenden doppelt ein.

- Sprachchat (PR #8) nur mit simuliertem Gemini getestet; `gemini-3.6-flash` als Modell-ID nach Doku angenommen (fehlt sie, springt die Kette weiter).
- Scientific Skills (Pharmazie): Literatursuche und PK-Rechner nicht als Jarvis-Sprachwerkzeug (`voiceTools.ts`) angebunden. PK-Rechner nur i.v.-Bolus/sofortige Aufnahme (keine orale Resorption mit ka, keine Infusion). `npm install` auf PiravinLap2 ändert `package-lock.json` (npm-Version, optionale emnapi-Pakete); bewusst nicht committet.

## Letzte Sitzungen

### 2026-10-19 – Cloud-Sitzung (vm, schnellerer Sprachchat, PR #8)
- Gemini im Sprachchat gestreamt (`streamGenerateContent?alt=sse`, `chatTurn` in `gemini.ts`); Vorlesen beginnt beim ersten fertigen Satz (`speaker()` in `speech.ts`, Browser + Android), Text erscheint live.
- Eigene Modellkette `VOICE_MODELS`: 3.6 Flash mit `thinkingLevel` low, Flash-Lite minimal, Flash neuestes low (3.5 Flash ist abgekündigt und wird auf 3.6 umgeleitet). 25 s Zeitlimit, 1 s Warten bei Überlast, bei 400 wegen thinking ohne wiederholen, nach gesprochenem Text kein Modellwechsel.
- `quickContext()` legt Tagesüberblick, Termine bis übermorgen und offene Aufgaben (mit IDs) in den Systemtext: häufige Fragen ohne Werkzeug-Runde. Regel: unabhängige Werkzeuge gleichzeitig aufrufen. `preconnect` zu Gemini.
- Sonnet-Prüfung: Abkürzungen (Prof., Dr.) trennen nicht, Satzstücke max. 220 Zeichen, breiterer 400-Check, Live-Text bei «Neues Gespräch» leeren.
- Tests: tsc, lint, build, voice-check (Stream, Satztrennung), gemini-check (400, Abriss), prep-check, Playwright mit simuliertem Gemini. Nicht mit echtem Gemini-Schlüssel getestet (keiner in der Cloud).

### 2026-10-18 – PiravinLap2 (/firma: Scientific Agent Skills in Jarvis)
- K-Dense Scientific Agent Skills (175, `npx skills`) liegen in `.agents/skills` mit Links in `.claude/skills`, beides ignoriert; `skills-lock.json` eingecheckt (`npx skills experimental_install`). Auswahl fürs Pharmaziestudium in CLAUDE.md.
- In `/pharmazie` übernommen: PK-Rechner Mehrfachgabe mit SVG-Kurve und therapeutischem Bereich (`src/lib/pharma/pk.ts`, nach `pkpd-modeling`), Veber-Regeln + ZNS-Hinweis im Steckbrief (nach `medchem`), Reiter «Literatur» mit Europe PMC (Titel/Abstract, Reviews, frei lesbar, Sortierung) und Vancouver-Zitat (`literature.ts`).
- CSP `connect-src` + `/datenschutz` um `www.ebi.ac.uk` ergänzt. Selbsttest `scripts/pk-check.ts`.
- Review durch Sonnet: Sortierung «meist zitiert» brachte fachfremde Volltext-Treffer → Suche auf Titel/Abstract. Browser-Test 390/1440 px: Handy-Überlauf (Eingabe-Eigenbreite in `.ph-unit`, Grid ohne `minmax(0,1fr)`) und HTML-Reste in Titeln behoben.
- Tests: tsc, lint, build, pk-check, Playwright Handy+Laptop ohne Konsolen-/CSP-Fehler. Commit `5d6aa7c`.

### 2026-10-16 – Cloud-Sitzung (/firma: Android-App)
- Capacitor 8 (`android/`, `capacitor.config.ts`, App-ID `ch.jarvis.app`) lädt die Vercel-Seite; native Teile in `src/lib/native.ts` (Spracherkennung, TTS, lokale Erinnerungen aus `buildReminders`, Fokus-Ende vorausgeplant, Teilen über `cache/share`, Zurück-Taste in `NativeShell.tsx`). Website lädt keinen Capacitor-Code (nur dynamische Imports hinter `isNativeApp()`).
- Stolperfalle: Capacitor-Plugin-Objekte nie aus `await`/`.then` zurückgeben (Proxy wirkt wie ein Promise, hängt ewig); immer Modul laden und Plugin daraus nehmen.
- Kein Android-SDK im Cloud-Container (dl.google.com gesperrt): APK baut `.github/workflows/android.yml`, Release `android-latest` auf `main`.
- Tests: tsc, lint, build, voice-check, Gradle in Actions, Playwright mit nachgebildeter Brücke (Skript lag im Scratchpad), Sicherheitsprüfung durch Mitarbeiter, Befunde behoben.

### 2026-10-16 – Cloud-Sitzung (Nachbereitungsplan, Gedächtnis, Verlauf)
- Nachbereitungsplan `src/lib/prepPlan.ts`: alle nicht nachbereiteten Vorlesungen seit Semesterbeginn (frühester `slot.from`), Einheiten in freien Fenstern (werktags 13–20, Wochenende 10–17, 60 Min., Tagesmaximum), frische Vorlesungen am selben Tag zuerst. Wird nie gespeichert, immer neu gerechnet; Markierungen `prep-settings`, `prep-pin:<lektion>`, `prep-seen`, `nachbereitet:<lektion>`.
- Verschiebungen nach hinten (Termin oder verpasst) zeigt `PrepMoves` mit Grund + 3 Alternativen; ohne Verschiebung wird `prep-seen` still aktualisiert. Einheiten im Kalender, Startseite, .ics, Push (`prep`, 10 Min. vorher), Briefing.
- Sprache: `nachbereitung_plan/_erledigt/_verschieben`, `keine_zeit` (trägt Sperrtermin „Keine Zeit“ ein), `lernzeiten_einstellen`, `merken`/`vergessen` (Mark `jarvis-memory`, geht in den Systemtext); `termin_anlegen/_aendern` melden `ueberschneidungen` und `nachbereitung_verschoben`.
- Gespräche: neuer Store `chats` (IndexedDB v5, abgeglichen), „Verlauf“ im Sprachbildschirm, Fortsetzen unter 3 h, max. 50. Datenschutz ergänzt.
- Tests: tsc, lint, build, voice-check, neues `prep-check.ts`, Playwright 390/1440 ohne Fehler, Chat mit simuliertem Gemini. PR #5 (Branch `claude/nachbereitung-lernplan-9kmbv8`), Commit `14659f7`, Vorschau geprüft und in `main` übernommen.

### 2026-10-16 – PiravinLap2 (/firma: Design, Animationen, Vorlesungs-Fix)
- Ruhiges helles «Laborjournal»-Design gebaut (`19f8b1b`), Nutzer wollte aber Jarvis/HUD/Futuristisch zurück: alte Design-Dateien wiederhergestellt, Verbesserungen behalten (Atkinson Hyperlegible Next für Fliesstext, 4/8-px-Raster `--space-*`, Skip-Link, `role=status/alert` im Konto, Texte ohne Gedankenstriche, de-CH). Regeln in DESIGN.md §11.
- Viele Animationen: driftendes Raster + Partikel-Netz (`Particles.tsx`), Hologramm-Panels, Scan-Linie, gestaffeltes Einrasten, Seitentitel-Decode (`PageTitleDecode.tsx`), Split-flap-Uhr (`SplitFlap.tsx`), Zahlen hochzählen (`CountUp.tsx`), Sekundenzeiger im HudRing, Orb mit Partikeln/Equalizer/Hochfahren, drehendes Paracetamol-Drahtgitter (`Wireframe.tsx`, /jarvis + /pharmazie). Alles aus bei reduced-motion.
- Vorlesung: «Titel und Fach ändern» springt zum Formular und fokussiert den Titel (`61cfcd4`).
- Stolperfalle: `.next` im OneDrive-Ordner → `EINVAL readlink`; Abhilfe `rm -rf .next`. Atkinson braucht `adjustFontFallback: false` (sonst Build-Warnung).
- Tests: tsc, lint, build, voice-check; Produktions-Build 17 Seiten ohne Konsolen-/CSP-Fehler, Screenshots in `.shots/` (ignoriert).
