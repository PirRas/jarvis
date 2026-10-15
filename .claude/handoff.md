# Übergabe zwischen Sitzungen

Wird von `/close` gepflegt. Am Anfang jeder Sitzung lesen (siehe CLAUDE.md).

## Nächste Aufgabe

keine

## Offen

- nichts

## Letzte Sitzungen

### 2026-10-15 – PiravinsLap
- Skill `/firma` gebaut: Opus plant und prüft, Haiku/Sonnet-Mitarbeiter (`.claude/agents/`) arbeiten.
- Erster Firma-Lauf: Aufräumen von ungenutztem Code (4 tote Funktionen/Typen gelöscht, 22 interne Exporte privat, `public/icon.svg` entfernt). tsc, lint, build grün.
- Skill `/close` gebaut (dieser Ablauf), `CLAUDE.md` und diese Übergabe angelegt.
- Gedächtnis eingerichtet: Projektwissen im Repo (diese Datei + `CLAUDE.md`), Vorlieben in der lokalen Memory.
- `/close` korrigiert: Die Sitzung läuft im Hintergrund beim Claude-Daemon, das Git-Bash-Fenster zeigt sie nur an. Das Skript findet das Fenster jetzt über den Sitzungstitel und schliesst es zusammen mit der Sitzung.
- Commits: `961280a` Firma-Skill, `7641727` Aufräumen, `e8e8768` Gedächtnis + `/close`, `ef811cd` Übergabe, `536ee5e` Fenster-Fix.
