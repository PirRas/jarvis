---
name: nachbereitung
description: Vorlesungs-PDF lesen, Notizen und Lernmaterial (Karteikarten, Quiz) selbst erstellen und direkt in Jarvis (Supabase) speichern, ohne Gemini oder API. Nur verwenden, wenn der Nutzer /nachbereitung aufruft.
argument-hint: <pfad zur pdf>
---

# /nachbereitung – PDF zu Jarvis-Vorlesung

PDF: **$ARGUMENTS**

Einmalig nötig: in `.env.local` (nie einchecken) `JARVIS_EMAIL=…` und `JARVIS_PASSWORD=…` (Konto wie in der App unter /konto). Fehlen sie, melde das und stoppe.

1. **Fächer holen:** `npx tsx scripts/nachbereitung-save.ts --courses` (bei Fehler: leere Liste nehmen).
2. **PDF lesen:** Read-Tool mit `pages: "1-20"`, `"21-40"` … bis zum Ende (max. 20 Seiten pro Aufruf).
3. **Notizen:** Lies `notesPrompt` in `src/lib/prompts.ts` und befolge ihn genau (Fächerliste aus Schritt 1 einsetzen). Schreibe das reine JSON nach `<Scratchpad>/notes.json`. Diagramme als Mermaid-Codeblock und Strukturformeln als `pubchem:`-Bild und Abbildungen als `wiki:`-Bild (Wikimedia Commons) nur dort, wo sie das Verständnis verbessern.
4. **Lernmaterial:** Befolge `STUDY_PROMPT` aus `src/lib/prompts.ts` auf Basis derselben Folien. JSON nach `<Scratchpad>/study.json`. Keine Videos (macht die App).
5. **Prüfen:** `npx tsx scripts/nachbereitung-save.ts <Scratchpad>/notes.json <Scratchpad>/study.json --dry-run`. Bei Fehlermeldung die JSON-Datei korrigieren und wiederholen.
6. **Speichern:** derselbe Aufruf ohne `--dry-run`. Gib die Ausgabe (Titel, Fach, Anzahl Karten/Fragen) kurz wieder. Die Vorlesung erscheint beim nächsten Abgleich in der App. Ist im Konto 2FA aktiv, den Nutzer nach dem aktuellen Code fragen und `--code=…` anhängen.
