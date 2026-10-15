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
- `.env` enthält nur öffentliche Supabase-Werte und ist absichtlich eingecheckt. Geheimnisse nur in `.env*.local` oder Vercel.
- `scripts/check.ts` und `scripts/rooms-check.ts` sind manuelle Testwerkzeuge, kein toter Code.

## Checks
- `npx tsc --noEmit`, `npx eslint . --max-warnings 0`, `npm run build`. Es gibt keine automatischen Tests.

## Git
- Commit-Nachrichten auf Deutsch: `Bereich: was gemacht wurde`. Branch `main`, direkt pushen ist üblich.
- Auf manchen Laptops ist keine Git-Identität gesetzt: dann Autor des letzten Commits mit `git -c user.name=… -c user.email=…` verwenden, Config nicht ändern.

## Arbeitsweise
- Plugins `ponytail` und `superpowers` sind im Projekt aktiv (`.claude/settings.json`).
- Ponytail (full) ist Standard: kleinste Änderung, die die Aufgabe ganz löst, keine Vorrats-Abstraktionen. Bewusste Abkürzungen mit `// shortcut:` markieren (`/ponytail-debt` listet sie).
- Grössere Features: erst `superpowers:brainstorming`, dann `superpowers:writing-plans`. Vor „fertig“ immer die Checks unten laufen lassen (`superpowers:verification-before-completion`).
- Review: `/ponytail-review` für eine Änderung, `/ponytail-audit` fürs ganze Repo.

## Skills
- `/firma <aufgabe>`: Opus als Chef, Mitarbeiter-Agenten in `.claude/agents/` (Haiku/Sonnet).
- `/close [nächste aufgabe]`: Sitzung abschliessen – Checks, Commit + Push, Gedächtnis pflegen, Fenster schliessen.
