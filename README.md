# Jarvis – Uni-Cockpit

Persönliches Cockpit für das Studium der Pharmazeutischen Wissenschaften an der Universität Basel.

## Was Jarvis kann

- **Heute**: Beim Öffnen siehst du sofort, was als Nächstes kommt, wie lange es noch dauert und in welchem Raum.
  Dazu die Tagesliste, Prüfungen und Fristen mit Countdown und Lernstand sowie Empfehlungen für den Tag.
- **Räume live aus dem Vorlesungsverzeichnis**: Für jede Lektion mit Veranstaltungsnummer (z. B. 10380) holt Jarvis
  die Einzeltermine aus vorlesungsverzeichnis.unibas.ch. Je näher die Lektion, desto häufiger wird geprüft
  (alle 10 Minuten in den letzten 3 Stunden). Weicht der Raum vom üblichen Raum ab, erscheint eine auffällige,
  gelb-rote Warnung „Anderer Raum!“ mit dem sonst üblichen Raum durchgestrichen daneben. Fehlt ein Termin im
  Verzeichnis, weist Jarvis darauf hin, dass die Lektion vielleicht ausfällt.
- **Stundenplan**: Vorlage „Pharmazeutische Wissenschaften, 1. Semester, HS 2026“ nach dem Wochenplan des
  Departements, eigene Einträge oder Import aus Foto/PDF über Claude.
- **Kalender**: Stundenplan, eigene Termine, Prüfungen, Fristen und abonnierte Kalender (ADAM, Outlook) an einem Ort.
  Termine lassen sich aus kopiertem Text erkennen (Ankündigungen, Mails, Prüfungsübersicht) und als .ics exportieren.
- **Lektions-Vorschau**: Folien (PDF) vor der Lektion hinzufügen; Jarvis zeigt sofort die Themen und auf Wunsch eine
  Kurzzusammenfassung von Claude.
- **Links**: ADAM, Online-Services, Outlook, Vorlesungsverzeichnis, Departement, Fachgruppe, Compendium,
  Swissmedicinfo, Bibliothek und mehr. ADAM und services.unibas.ch verbieten das Einbetten in andere Seiten
  (`frame-ancestors 'self'`), daher öffnen sie sich in einem neuen Tab.
- **Nachbereitung**: Vorlesungsfolien mit Claude nachbereiten, Karteikarten mit verteilter Wiederholung, Quiz und
  Klausuraufgaben (siehe unten).

## Nachbereitung hinzufügen

1. Unter „Vorlesungen“ auf „Neue Vorlesung hinzufügen“ tippen.
2. Auf claude.ai einen neuen Chat öffnen und die Folien als PDF anhängen.
3. „Prompt 1 kopieren“, im Chat einfügen, senden und Claudes Antwort zurück in die App kopieren.
4. „Prompt 2 kopieren“, im selben Chat senden und die Antwort ebenfalls einfügen.
5. „Vorlesung speichern“.

## Technik

- Next.js auf Vercel (Gratis-Stufe). Zwei kleine Server-Routen:
  - `GET /api/vv?nr=10380` liest Termine und Räume aus dem Vorlesungsverzeichnis (10 Minuten zwischengespeichert).
  - `POST /api/ics` holt Kalender-Abos ab (Browser dürfen fremde Kalender nicht direkt laden).
- Alle Daten liegen im Browser (IndexedDB) und werden über Supabase zwischen Handy und PC abgeglichen,
  sobald du unter „Konto“ angemeldet bist. Tabelle: `supabase/schema.sql`.

```
npm install
npm run dev
```

Dann http://localhost:3000 öffnen.

## Installieren

- **Android:** Seite in Chrome öffnen, Menü → „Zum Startbildschirm hinzufügen“.
- **Windows:** Seite in Edge oder Chrome öffnen, in der Adressleiste „App installieren“.

## Tastenkürzel beim Lernen

| Taste | Aktion |
|---|---|
| Leertaste / Enter | Antwort zeigen |
| 1 / 2 / 3 / 4 | Nochmal / Schwer / Gut / Einfach |
| Strg+Z | Letzte Bewertung rückgängig |
| @ | Karte zurückstellen |
