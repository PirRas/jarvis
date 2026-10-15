---
name: close
description: Sitzung abschliessen – Checks, alles committen und pushen, Gedächtnis (CLAUDE.md, .claude/handoff.md, lokale Memory) weiterführen, Zusammenfassung auflisten, nächste Aufgabe vorbereiten und danach das Fenster schliessen. Nur verwenden, wenn der Nutzer /close aufruft oder ausdrücklich die Sitzung so beenden will.
argument-hint: [nächste Aufgabe, optional]
---

# /close – Sitzung sauber abschliessen

Zusatz vom Nutzer (kann eine neue Aufgabe enthalten): **$ARGUMENTS**

Arbeite die Schritte der Reihe nach ab. Stoppt ein Schritt mit einem Problem, das du nicht sicher selbst lösen kannst: **nicht weitermachen, nicht schliessen**, sondern das Problem melden.

## 1. Bestandsaufnahme
- `git status --short`, `git log --oneline origin/main..HEAD` (noch nicht gepushte Commits).
- Was wurde in dieser Sitzung gemacht? Aus dem Gesprächsverlauf zusammenstellen (Funktionen, Fixes, Entscheidungen, Commits).
- Gibt es eine **neue Aufgabe**? Aus `$ARGUMENTS` oder aus dem Gespräch („nächstes Mal …“, „später noch …“, offene Punkte, die der Nutzer gewollt hat).

## 2. Checks (nur wenn Code geändert wurde)
- `npx tsc --noEmit` und `npx eslint . --max-warnings 0`.
- Fehler aus dieser Sitzung: beheben, wenn klein und eindeutig. Sonst nicht pushen, melden und hier stoppen.

## 3. Gedächtnis weiterführen
Das Gedächtnis liegt **im Repo**, damit es auf jedem Laptop gilt:

**`.claude/handoff.md`** – immer aktualisieren:
- `## Nächste Aufgabe`: Wenn eine neue Aufgabe genannt wurde, so vorbereiten, dass sie beim nächsten Mal sofort losgehen kann:
  - Ziel (1–2 Sätze, in den Worten des Nutzers)
  - Kontext: relevante Dateien/Stellen (kurz selbst nachsehen bzw. `recherche-haiku` nutzen, damit die Pfade stimmen)
  - Plan in Schritten, mit Abnahmekriterien
  - Vorschlag, ob `/firma` passt, und welche Pakete/Mitarbeiter
  - Offene Fragen an den Nutzer (falls es welche gibt)
  
  Keine neue Aufgabe → bisherige „Nächste Aufgabe“ stehen lassen, falls noch nicht erledigt; sonst „keine“.
- `## Letzte Sitzungen`: neuen Eintrag **oben** einfügen (Datum, Gerät/Hostname via `hostname`, 3–6 Stichpunkte, Commits). Nur die letzten 5 Einträge behalten.
- `## Offen`: was angefangen, aber nicht fertig ist; Erledigtes entfernen.

**`CLAUDE.md`** – nur ändern, wenn es **dauerhaftes** neues Wissen gibt (neue Konvention, wichtige Architektur-Entscheidung, neuer Befehl, Stolperfalle). Kurz halten, nichts doppeln, was im Code oder in git steht.

**Lokale Memory** (das Memory-Verzeichnis aus dem Systemprompt) – Vorlieben/Feedback des Nutzers, die du in dieser Sitzung gelernt hast, nach den üblichen Memory-Regeln speichern. Projektwissen gehört ins Repo, nicht hierhin.

## 4. Commit & Push
- Vor `git add -A`: Status ansehen. **Nie** committen: `.env*.local`, `*.pem`, Schlüssel/Tokens, grosse Fremddateien. Im Zweifel nachfragen.
- Wenn möglich thematisch getrennte Commits (Code-Änderungen vs. Gedächtnis), sonst ein Commit.
- Commit-Nachricht auf Deutsch im Stil des Repos (`Bereich: was gemacht wurde`), mit der Co-Authored-By-Zeile aus den Systemhinweisen.
- Git-Identität fehlt? Nicht die Config ändern, sondern Autor des letzten Commits übernehmen:
  `git -c user.name="<name>" -c user.email="<mail>" commit …` (Werte aus `git log -1 --format='%an|%ae'`).
- `git pull --rebase` (der andere Laptop könnte gepusht haben), dann `git push`.
- Konflikte: nicht raten, melden und stoppen.

## 5. Abschlussbericht
Kurz, auf Deutsch, als Liste:
- **Erledigt in dieser Sitzung:** Stichpunkte
- **Commits:** Hash + Titel (alle gepushten)
- **Gedächtnis:** was in handoff/CLAUDE.md/Memory aktualisiert wurde
- **Nächste Aufgabe:** eine Zeile, oder „keine“
- **Offen/Probleme:** oder „nichts“
- Letzte Zeile: „Fenster schliesst in 15 Sekunden.“

## 6. Fenster schliessen
Nur wenn Schritte 1–5 ohne offenes Problem durchgelaufen sind und der Push geklappt hat. Als **letzter** Tool-Aufruf, direkt vor dem Abschlussbericht:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/skills/close/fenster-schliessen.ps1 -Delay 15
```

Das Skript schliesst das Fenster dieser Sitzung (z. B. Git Bash, gefunden über den Sitzungstitel im Fenstertitel) und beendet die Sitzung. Andere Claude-Fenster bleiben offen. Ist das Fenster nicht eindeutig, endet nur die Sitzung, und der Bericht sagt das. Danach den Abschlussbericht schreiben und nichts mehr tun.
