# Übergabe zwischen Sitzungen

Wird von `/close` gepflegt. Am Anfang jeder Sitzung lesen (siehe CLAUDE.md).

## Nächste Aufgabe

keine (Vorschlag, falls gewünscht: eine Vorlesung mit vielen Abbildungen neu hochladen und Bilder/Quiz-Korrektur auf dem Handy in der App ansehen).

## Offen

- Android-App (PR #6, `ANDROID.md`): 2026-10-16 vom Nutzer auf dem Handy getestet, «funktioniert soweit alles». Nicht einzeln bestätigt: Erinnerungen bei geschlossener App, Fokus-Meldung, .ics teilen.
- Android-Signierschlüssel eingerichtet (2026-10-21), APK 1.0.9 signiert und vom Nutzer installiert. Schlüssel `~/.jarvis/jarvis-release.jks` nur auf PiravinLap2; `Android.txt` (Passwort im Klartext) liegt im Projektordner, per `.git/info/exclude` ausgeschlossen, Nutzer soll sie in den Passwortmanager übertragen und löschen.
- Vor Launch der App: eigene Domain statt `nachbereitung.vercel.app` (App vertraut der Adresse vollständig), Vercel-Projekt nie umbenennen/löschen.

- Nachbereitungsplan (PR #5) nur mit Beispiel-Stundenplan getestet, nicht mit dem echten Abo und nicht mit echtem Supabase-Abgleich (Store `chats`, Markierungen). Hochladen einer alten PDF deckt die jüngste offene Lektion des Fachs ab, nicht zwingend die gemeinte (Zählung stimmt).
- Launch-Vorbereitung (nur Nutzer, README „Launch-Checkliste“): `supabase/schema.sql` + `supabase/push.sql` im SQL-Editor erneut ausführen (2FA-Regel, sonst schützt 2FA die Daten nicht); in Vercel `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_DATA_REGION` setzen; Supabase-Auth-Einstellungen (Passwortlänge 10, MFA, CAPTCHA, Redirect URLs); Vercel-Firewall-Rate-Limit für `/api/*`.
- 2FA-Ablauf und „Konto löschen“ sind nicht gegen echtes Supabase getestet (kein Schlüssel in der Cloud).
- `/nachbereitung` einmal echt ausprobieren: dafür `JARVIS_EMAIL`/`JARVIS_PASSWORD` in `.env.local` eintragen (Login und Schreiben nach Supabase sind ungetestet, nur `--dry-run` geprüft).
- Design (DESIGN.md §10) bewusst weggelassen: Sidebar-Icons, Mission-Timeline, Werkzeug-Kacheln, Desktop-Sprachleiste unten, Glocke/Suche in der Kopfzeile, Feed-Stil für Prüfungen/Raumwarnungen/Uni-Mail. Tablet-Breite 641–760 px mit Sidebar ist eng; alte `.topnav`-Regel für diese Breite ist wirkungslos.
- OpenRouter-Weg (Folientext via pdf.js) unter Node nicht testbar (`readPdf` lädt den Worker fest von `/pdf.worker.min.mjs`).
- Mobile Push für Claude-Benachrichtigungen ist in `/config` aus.
- Animationen (DESIGN.md §11) nur bei 390 px und 1440 px geprüft, nicht auf Tablet und nicht auf schwachen Handys (Partikel-Canvas, Wireframe, Hologramm-Schimmer). Bekannt: Checkbox-Ring läuft beim Laden auch bei schon erledigten Aufgaben; verschachtelte `.sheet` blenden doppelt ein.

- Bilder in Nachbereitungen (Mermaid, `pubchem:`, `wiki:`): mit echten Gemini-Antworten (Kurs 4 Wurzel/Blatt, Mikrobiologie) auf einer Testseite geprüft, nicht über den ganzen Hochladen-Ablauf auf dem Handy. Seit 2026-10-21 Structured Output (`responseJsonSchema` aus den Zod-Schemas) und Relevanzprüfung/Ersatzbegriffe für `wiki:`; mit echter PDF (Physiologie W6 Membranpotential) und Flash-Lite getestet (5 Bilder, 2 von 3 Wiki-Begriffen mit passendem Bild), Gemini 3.5 Flash war überlastet (503), Flash (neuestes) nur ohne Schema getestet. Schon gespeicherte Vorlesungen bekommen keine Bilder nachträglich (nur neu hochladen); ihre kaputten Formeln (`\text` als Tab) repariert `Md` bei der Anzeige.
- Alter OneDrive-Ordner `B1/Claude` (jarvis, vorlesung-app) ist gelöscht. Andere Laptops brauchen einen frischen `git clone` nach `C:\Users\<Name>\Jarvis` (siehe CLAUDE.md); die Schlüsseldateien `VALID_Keys.txt`/`OpenRouter_API_key.txt` liegen nur auf PiravinLap2 im Projektordner (per `.git/info/exclude` ausgeschlossen).
- Scientific Skills (Pharmazie): Literatursuche und PK-Rechner nicht als Jarvis-Sprachwerkzeug (`voiceTools.ts`) angebunden. PK-Rechner nur i.v.-Bolus/sofortige Aufnahme (keine orale Resorption mit ka, keine Infusion). `package-lock.json` wird mit npm 10 erzeugt (wie GitHub Actions, Node 22): `npx npm@10 install --package-lock-only`, sonst bricht `npm ci` im Android-Build ab.

## Letzte Sitzungen

### 2026-10-21 – PiravinLap2 (Quiz-Korrektur, Android-Signatur, bessere Wiki-Bilder)
- Quiz: offene Antworten per KI prüfen (`gradeAnswer` in `gemini.ts`, `gradePrompt`, `GradeSchema`): richtig/teilweise/falsch, Richtig/Falsch/Fehlt, ideale Antwort; nur «richtig» zählt. Datenschutzseite ergänzt. Mit echtem Gemini getestet.
- Android-Build lief seit `7075f60` nicht (Lock-Datei ohne `@emnapi`): mit npm 10 neu erzeugt. Signierschlüssel per Skript gesetzt, Release 1.0.9 «signiert», Nutzer hat installiert.
- Wiki-Bilder: Bild nur, wenn ≥ 2/3 der Inhaltswörter des Begriffs in Titel/Beschreibung (erste 300 Zeichen)/Kategorien stehen (NASA-Foto bei «single channel recording»), «nasa» nicht mehr bevorzugt, `wiki:a|b|c` Ersatzbegriffe, Prompt verlangt ≥ 5 Bilder.
- Gemini Structured Output gegen kaputtes JSON (Zeilenumbruch im String, Listen ohne Anführungszeichen).
- Tests: tsc, lint, build, wiki-check, gemini-check, Playwright 390/1440 (Quiz mit simuliertem Gemini), lecture-check mit echter PDF. Commits `0981b85`, `9307215`, `cf1615f`, `8485815`.

### 2026-10-20 – Cloud-Sitzung (Wiki-Bilder nur Deutsch/Englisch, PR #9)
- Nutzer bekam kurdisch/arabisch beschriftete Commons-Bilder (Nachbereitung über claude.ai; Bildwahl passiert aber immer in der App, `findWiki`).
- Neu `src/lib/wikiPick.ts`: harter Filter (fremde Schrift/Sonderbuchstaben/Sprachcode im Titel, Kategorien `<Sprache>-language`, mehrsprachige Beschreibung ohne de/en, Beschreibung ohne de/en-Wörter, Raster < 500 px), Punkte für SVG/Schema, Featured/Quality, OpenStax/Servier/Blausen, Auflösung, deutsch.
- `Diagram.tsx`: 20 Treffer, `iiextmetadatamultilang`. Prompt: genauere Lehrbuch-Suchbegriffe. Selbsttest `scripts/wiki-check.ts` (in CLAUDE.md eingetragen).
- Mit /firma (Haiku/Sonnet) umgesetzt. Commons-API in der Cloud gesperrt: nicht gegen echte Treffer getestet.

### 2026-10-20 – PiravinLap2 (Bilder in Nachbereitungen, Umzug aus OneDrive)
- Nachbereitungen mit Mermaid-Diagrammen, PubChem-Strukturformeln und Wikimedia-Commons-Bildern (`Diagram.tsx`, `Md.tsx`, Prompt, CSP, Datenschutz) fertiggestellt und mit echten PDFs + Gemini getestet.
- `parseClaudeJson` repariert KI-Fehler: `\text`/`\frac` mit einem Backslash (sonst still Tab/Formfeed), ungültige Escapes (`\Delta`), unmaskierte `"` in Mermaid-Blöcken; unbekannte Kartenart → «konzept». `Md` repariert alte Vorlesungen bei der Anzeige.
- Wiki-Bilder: 8 Treffer, Schemata/SVG und deutsche Fassungen bevorzugt, Fremdsprachen nach hinten, Rückfall nur ohne «diagram». Prompt verlangt ≥3 Bilder/Diagramme und beschriftete Schemata. Überschriften trennen lange Wörter.
- Projekt nach `C:\Users\Startklar\Jarvis` umgezogen (Skill-Junctions neu, Memory kopiert), OneDrive-Ordner gelöscht, Codex-Reste (`AGENTS.md`, `.codex/`) gelöscht.
- Tests: tsc, lint, build, Assert-Selbsttests für den Parser, Playwright 390 px mit echten Nachbereitungen. Commits `7075f60` … `dfda0a7`.

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
