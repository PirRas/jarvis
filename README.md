# Nachbereitung

Vorlesungsfolien mit Claude nachbereiten und für die Prüfung lernen, komplett kostenlos.
Die Aufbereitung läuft über dein Claude-Konto auf claude.ai (auch im Gratis-Plan). Die App selbst braucht weder einen Server noch einen API-Schlüssel.

Aus jeder Vorlesung entstehen:

- eine vollständige Nachbereitung Folie für Folie, mit Lernzielen, Kernaussagen und Prüfungstipps
- eine Folienübersicht als Vollständigkeitskontrolle
- ein Glossar und eine Formelsammlung
- Karteikarten mit verteilter Wiederholung wie bei Anki
- ein Quiz und Klausuraufgaben mit Musterlösung

## So fügst du eine Vorlesung hinzu

1. In der App auf „Neue Vorlesung hinzufügen“ tippen.
2. Auf claude.ai einen neuen Chat öffnen und die Folien als PDF anhängen.
3. „Prompt 1 kopieren“, im Chat einfügen, senden und Claudes Antwort zurück in die App kopieren.
4. „Prompt 2 kopieren“, im selben Chat senden und die Antwort ebenfalls einfügen.
5. „Vorlesung speichern“.

Wurde eine Antwort abgeschnitten, schreib im Chat „weiter“ und füge beide Teile hintereinander ein. Sehr lange Foliensätze teilst du am besten in zwei PDFs auf.

## Lokal starten

```
npm install
npm run dev
```

Dann http://localhost:3000 öffnen.

## Kostenlos online stellen (für Android)

`npm run build` erzeugt im Ordner `out/` eine rein statische Website. Diese lässt sich kostenlos bei Vercel, Netlify oder GitHub Pages hosten.

- **Android:** Die Seite in Chrome öffnen und im Menü „Zum Startbildschirm hinzufügen“ wählen.
- **Windows:** Die Seite in Edge oder Chrome öffnen und in der Adressleiste auf „App installieren“ klicken.

## Tastenkürzel beim Lernen

| Taste | Aktion |
|---|---|
| Leertaste / Enter | Antwort zeigen |
| 1 / 2 / 3 / 4 | Nochmal / Schwer / Gut / Einfach |
| Strg+Z | Letzte Bewertung rückgängig |
| @ | Karte zurückstellen |

## Wo die Daten liegen

Vorlesungen, Karten und Lernfortschritt werden auf dem jeweiligen Gerät im Browser gespeichert (IndexedDB). Handy und PC haben getrennte Daten, solange kein Abgleich (z. B. über Supabase, Gratis-Stufe) eingerichtet ist.
