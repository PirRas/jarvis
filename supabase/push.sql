-- Push-Benachrichtigungen für Jarvis.
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen (einmalig).
-- Vorher unten <PUSH_CRON_SECRET> durch denselben geheimen Wert ersetzen, der in Vercel als PUSH_CRON_SECRET hinterlegt ist.

-- 1. Push-Abos der Geräte (ein Eintrag pro Browser/Handy)
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "eigene Abos" on public.push_subscriptions;
create policy "eigene Abos" on public.push_subscriptions for all
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- 2. Erinnerungsplan: Die App berechnet die Erinnerungen der nächsten Wochen und legt sie hier ab;
--    der Server verschickt sie zur fälligen Zeit.
create table if not exists public.push_schedule (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,               -- z. B. "todo:preset-hs26-examensanmeldung:7d"
  due_at timestamptz not null,
  title text not null,
  body text not null,
  url text not null default '/',
  sent_at timestamptz,
  primary key (user_id, key)
);
create index if not exists push_schedule_due_idx on public.push_schedule (due_at) where sent_at is null;

alter table public.push_schedule enable row level security;
drop policy if exists "eigener Plan" on public.push_schedule;
create policy "eigener Plan" on public.push_schedule for all
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.push_schedule to authenticated;
revoke all on public.push_schedule from anon;

-- 3. Alle 5 Minuten den Versand anstossen (pg_cron + pg_net, in Supabase kostenlos)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('jarvis-push') where exists (select 1 from cron.job where jobname = 'jarvis-push');
select cron.schedule(
  'jarvis-push',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://nachbereitung.vercel.app/api/push/tick',
    headers := jsonb_build_object('authorization', 'Bearer <PUSH_CRON_SECRET>', 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- 4. Alte, verschickte Erinnerungen nach 30 Tagen aufräumen (täglich um 03:00 UTC)
select cron.unschedule('jarvis-push-cleanup') where exists (select 1 from cron.job where jobname = 'jarvis-push-cleanup');
select cron.schedule(
  'jarvis-push-cleanup',
  '0 3 * * *',
  $$ delete from public.push_schedule where due_at < now() - interval '30 days'; $$
);
