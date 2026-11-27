# Sicherheit / Security

Bitte melde Sicherheitslücken **nicht** als öffentliches Issue, sondern privat über
GitHub → *Security* → *Report a vulnerability* (Private Vulnerability Reporting) dieses Repositorys.
Beschreibe, was betroffen ist und wie man es nachvollziehen kann. Du bekommst so bald wie möglich eine Antwort.

Please do **not** open public issues for security problems. Use GitHub's private vulnerability reporting
(*Security* → *Report a vulnerability*) on this repository instead.

## Hinweise zum Aufbau
- `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env` sind absichtlich öffentlich:
  Sie sind für den Browser gedacht, der Datenzugriff ist über Row Level Security geschützt (`supabase/schema.sql`,
  `supabase/push.sql`).
- Server-Geheimnisse (`SUPABASE_SECRET_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET`) liegen nur beim Hoster.
- KI-Schlüssel (Gemini, OpenRouter, YouTube) trägt jede Person selbst ein; sie bleiben im Browser (localStorage).
