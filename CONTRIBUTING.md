# Mitmachen / Contributing

Danke, dass du Jarvis verbessern willst! *English below.*

## Kurz
1. Issue öffnen oder ein bestehendes kommentieren, bevor du Grösseres baust.
2. Fork, Branch, Änderung. Kleinste Änderung, die das Problem ganz löst; keine Vorrats-Abstraktionen.
3. Vor dem Pull Request lokal prüfen:
   ```
   npm ci
   npx tsc --noEmit
   npx eslint . --max-warnings 0
   npm run build
   ```
   Für einzelne Bereiche gibt es Selbsttests in `scripts/` (Liste in `CLAUDE.md` unter „Checks“), z. B.
   `npx tsx scripts/voice-check.ts` bei Änderungen am Sprachassistenten.
4. Pull Request mit kurzer Beschreibung: was, warum, wie getestet.

## Konventionen
- UI-Texte auf Deutsch, Datums- und Zahlenformat `de-CH`.
- Commit-Nachrichten auf Deutsch: `Bereich: was gemacht wurde` (z. B. `Kalender: Serientermine mit Enddatum`).
- Import-Alias `@/` = `src/`. KI-Antworten im JSON-Format laufen durch `parseClaudeJson` und bekommen ein Zod-Schema.
- Neue externe Hosts (fetch, Bilder, iframes) in der Content-Security-Policy in `next.config.ts` freigeben.
- Nur kostenlose KI-Dienste (siehe `src/lib/gemini.ts`); keine bezahlten APIs als Pflicht.
- Das HUD-Design (Orb, Ring, Glow, Animationen) ist gewollt, siehe `DESIGN.md` §11.
- Native Android-Funktionen nur über `src/lib/native.ts` (siehe `ANDROID.md`).
- `package-lock.json` mit npm 10 erzeugen: `npx npm@10 install --package-lock-only`.

## Sicherheit
- Keine Schlüssel, Passwörter oder persönlichen Daten committen. Geheimnisse gehören in `.env.local`
  (Vorlage: `.env.example`) oder in die Umgebungsvariablen des Hosters.
- Sicherheitslücken bitte nicht als öffentliches Issue melden, sondern wie in [`SECURITY.md`](SECURITY.md) beschrieben.

## Andere Studiengänge
Jarvis ist auf Pharmazeutische Wissenschaften an der Uni Basel zugeschnitten (Stundenplan-Vorlage, Links,
Vorlesungsverzeichnis). Anpassungen für andere Studiengänge oder Hochschulen sind willkommen, am besten so,
dass die Vorlagen austauschbar bleiben statt fest im Code zu stehen.

---

## English

Contributions are welcome. Please open an issue before larger changes, keep pull requests small and focused,
and run `npx tsc --noEmit`, `npx eslint . --max-warnings 0` and `npm run build` before submitting. The app's UI
is in German; code comments and commit messages are mostly German too, but English issues and PRs are fine.
Never commit secrets (use `.env.local`, see `.env.example`). Report security issues privately as described in
[`SECURITY.md`](SECURITY.md).

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
