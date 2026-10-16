# Jarvis – Hinweise für Claude

Persönliches Uni-Cockpit (Pharmazeutische Wissenschaften, Uni Basel). Details zu Funktionen: `README.md`.

## Sitzungsstart
- Lies `.claude/handoff.md`. Steht dort eine **Nächste Aufgabe**, nenne sie in deiner ersten Antwort in einem Satz und leg los, sobald der Nutzer zustimmt (ein „ja“/„los“ genügt). Der Plan dort ist schon vorbereitet.
- Arbeit auf mehreren Laptops: vor Arbeitsbeginn `git pull`.

## Kommunikation
- Immer auf Deutsch antworten. UI-Texte in der App auf Deutsch, Datums-/Zahlenformat `de-CH`.

## Technik
- Next.js 15 (App Router), React 19, TypeScript, auf Vercel. Import-Alias `@/` = `src/`.
- Daten im Browser (IndexedDB über `idb`, `src/lib/db.ts`), Abgleich über Supabase (`src/lib/sync.ts`, `supabase/schema.sql`).
- Push über `web-push` (`src/lib/pushServer.ts`, `public/sw.js`), Zod-Schemas in `src/lib/schema.ts`.
- Content-Security-Policy in `next.config.ts`: neue externe Hosts (fetch, Bilder, iframes) dort freigeben, sonst blockiert der Browser sie. App soll launch-tauglich bleiben (evtl. für Kommilitonen): Datenschutzseite `/datenschutz` aktuell halten, Launch-Checkliste im README.
- `.env` enthält nur öffentliche Supabase-Werte und ist absichtlich eingecheckt. Geheimnisse nur in `.env*.local` oder Vercel.
- `scripts/check.ts`, `scripts/rooms-check.ts` und `scripts/lecture-check.ts` (Echttest Aufbereitung mit echter PDF, `GEMINI_API_KEY` als Umgebungsvariable) sind manuelle Testwerkzeuge, kein toter Code.

## Checks
- `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npm run build`. Es gibt keine automatischen Tests.
- Bei Änderungen an `src/lib/textDates.ts`: `npx tsx scripts/textdates-check.ts`.
- Bei Änderungen an `src/lib/gemini.ts` (KI-Ausweichkette): `npx tsx scripts/gemini-check.ts`.
- Bei Änderungen am Sprachassistenten (`src/lib/voiceTools.ts`, `src/lib/jarvisAgent.ts`): `npx tsx scripts/voice-check.ts`.
- Bei Änderungen am Nachbereitungsplan (`src/lib/prepPlan.ts`, `src/lib/lernplan.ts`) oder seinen Sprachwerkzeugen: `TZ=Europe/Zurich npx tsx scripts/prep-check.ts`.
- `next dev`/`build` bricht mit `EINVAL readlink … .next` ab (OneDrive-Ordner): `rm -rf .next`, dann neu starten.
- Design: Das futuristische Jarvis-HUD (Orb, Ring, Glow, Animationen) ist gewollt, nicht wegdesignen. Regeln in `DESIGN.md` §11.

## Git
- Commit-Nachrichten auf Deutsch: `Bereich: was gemacht wurde`. Branch `main`, direkt pushen ist üblich.
- Auf manchen Laptops ist keine Git-Identität gesetzt: dann Autor des letzten Commits mit `git -c user.name=… -c user.email=…` verwenden, Config nicht ändern.

## Arbeitsweise
- Plugins `ponytail` und `superpowers` sind im Projekt aktiv (`.claude/settings.json`).
- Ponytail (full) ist Standard: kleinste Änderung, die die Aufgabe ganz löst, keine Vorrats-Abstraktionen. Bewusste Abkürzungen mit `// shortcut:` markieren (`/ponytail-debt` listet sie).
- Grössere Features: erst `superpowers:brainstorming`, dann `superpowers:writing-plans`. Vor „fertig“ immer die Checks unten laufen lassen (`superpowers:verification-before-completion`).
- Review: `/ponytail-review` für eine Änderung, `/ponytail-audit` fürs ganze Repo.

- Agenten aus `.claude/agents/` gibt es nur, wenn Claude im Ordner `jarvis` gestartet wurde; sonst `general-purpose` mit `model: haiku/sonnet`.
- KI-Aufbereitung kostenlos halten: keine bezahlten APIs (auch keine Claude-API). Gratis-Kette steht in `src/lib/gemini.ts`.

## Skills
- `/firma <aufgabe>`: Opus als Chef, Mitarbeiter-Agenten in `.claude/agents/` (Haiku/Sonnet).
- `/close [nächste aufgabe]`: Sitzung abschliessen – Checks, Commit + Push, Gedächtnis pflegen, Fenster schliessen.
- `/nachbereitung <pdf>`: Claude liest die PDF selbst, erzeugt Notizen + Lernmaterial und speichert per `scripts/nachbereitung-save.ts` in Supabase (braucht `JARVIS_EMAIL`/`JARVIS_PASSWORD` in `.env.local`).
