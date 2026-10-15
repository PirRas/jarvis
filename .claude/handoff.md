# Übergabe zwischen Sitzungen

Wird von `/close` gepflegt. Am Anfang jeder Sitzung lesen (siehe CLAUDE.md).

## Nächste Aufgabe

keine

## Offen

- Automatische Aufbereitung mit einer **echten, langen Vorlesungs-PDF** testen (bisher nur 1-seitige Test-PDF). Achten auf: Dauer, Qualität von Flash-Lite vs. 3.5 Flash, abgeschnittene JSON-Antworten bei vielen Folien.
- Idee, vom Nutzer zurückgestellt: `/nachbereitung <pdf>`-Skill, der die Aufbereitung mit Claude Code (Abo) macht und direkt in Supabase speichert – bessere Qualität als Gemini. Nur bauen, wenn der Nutzer es wieder anspricht.

## Letzte Sitzungen

### 2026-10-15 – PiravinLap2
- Plugins `ponytail` + `superpowers` im Projekt aktiviert (`.claude/settings.json`), graphify-Graph gebaut (`graphify-out/` ignoriert, pdf.js-Worker per `.graphifyignore` ausgeschlossen).
- Browser-Test aller 16 Seiten (Desktop + Handy) ohne Fehler; Fix: „Termine aus Text“ – mehrere Daten in einem Absatz bekommen eigene Uhrzeit/Titel/Art (`scripts/textdates-check.ts`).
- Neu: Folien automatisch aufbereiten ohne Claude-API (`src/lib/gemini.ts`): Kette Gemini 3.5 Flash → Flash-Lite → Flash (neuestes, langsam) → OpenRouter-Gratis (Nemotron, nur Folientext); Zeitlimit 3 Min.; Videos über YouTube-Data-API. Schlüssel (Gemini/OpenRouter/YouTube) pro Gerät im localStorage, eingetragen im Importer. Selbsttest `scripts/gemini-check.ts`.
- Echte Läufe: `gemini-flash-latest` (= 3.8) hängt im Gratis-Kontingent oft minutenlang, Gemini-Google-Suche ist im Gratis-Kontingent gesperrt (429) → deshalb YouTube-API. Komplettlauf zuletzt ~2 Min.
- Commits: `185ca36` Plugins, `86eac9e` graphify-Ignore, `397814b` Termine aus Text, `4ae2a25` Gemini-Automatik, `7495914` Ausweichkette + YouTube.

### 2026-10-15 – PiravinsLap
- Skill `/firma` gebaut: Opus plant und prüft, Haiku/Sonnet-Mitarbeiter (`.claude/agents/`) arbeiten.
- Erster Firma-Lauf: Aufräumen von ungenutztem Code (4 tote Funktionen/Typen gelöscht, 22 interne Exporte privat, `public/icon.svg` entfernt). tsc, lint, build grün.
- Skill `/close` gebaut (dieser Ablauf), `CLAUDE.md` und diese Übergabe angelegt.
- Gedächtnis eingerichtet: Projektwissen im Repo (diese Datei + `CLAUDE.md`), Vorlieben in der lokalen Memory.
- `/close` korrigiert: Die Sitzung läuft im Hintergrund beim Claude-Daemon, das Git-Bash-Fenster zeigt sie nur an. Das Skript findet das Fenster jetzt über den Sitzungstitel und schliesst es zusammen mit der Sitzung.
- Commits: `961280a` Firma-Skill, `7641727` Aufräumen, `e8e8768` Gedächtnis + `/close`, `ef811cd` Übergabe, `536ee5e` Fenster-Fix.
