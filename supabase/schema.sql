-- Abgleich zwischen Geräten: ein Datensatz pro lokalem Eintrag (Vorlesung, Karte, Wiederholung, Stundenplan, Termin …).
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

create table if not exists public.sync_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store text not null,                 -- lectures | cards | quiz | reviews | slots | events | feeds | links | previews
  id text not null,
  data jsonb,                          -- null bei gelöschten Einträgen
  deleted boolean not null default false,
  client_updated_at bigint not null,   -- Änderungszeit auf dem Gerät (ms), entscheidet bei Konflikten
  synced_at timestamptz not null default now(), -- Serverzeit, dient als Abruf-Cursor
  primary key (user_id, store, id)
);

create index if not exists sync_items_user_synced_idx on public.sync_items (user_id, synced_at);

-- Zeilenschutz: Jede Person sieht und ändert nur ihre eigenen Daten.
alter table public.sync_items enable row level security;

drop policy if exists "eigene Daten lesen" on public.sync_items;
create policy "eigene Daten lesen" on public.sync_items for select
  to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "eigene Daten anlegen" on public.sync_items;
create policy "eigene Daten anlegen" on public.sync_items for insert
  to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "eigene Daten ändern" on public.sync_items;
create policy "eigene Daten ändern" on public.sync_items for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "eigene Daten löschen" on public.sync_items;
create policy "eigene Daten löschen" on public.sync_items for delete
  to authenticated using ((select auth.uid()) = user_id);

-- Zwei-Faktor: Wer 2FA eingeschaltet hat, kommt nur mit bestätigtem Code (aal2) an die Daten.
drop policy if exists "2FA erzwingen" on public.sync_items;
create policy "2FA erzwingen" on public.sync_items as restrictive for all to authenticated
  using (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'
    )
  )
  with check (
    array[(select auth.jwt()->>'aal')] <@ (
      select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
      from auth.mfa_factors where (select auth.uid()) = user_id and status = 'verified'
    )
  );

-- Neue Tabellen sind nicht mehr automatisch über die Data API erreichbar: Zugriff ausdrücklich erlauben.
grant select, insert, update, delete on public.sync_items to authenticated;
revoke all on public.sync_items from anon;

-- Konfliktregel "neueste Änderung gewinnt": Ältere oder gleich alte Stände überschreiben nichts
-- und verändern synced_at nicht (verhindert Ping-Pong zwischen Geräten).
create or replace function public.sync_items_last_write_wins()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.client_updated_at <= old.client_updated_at then
    return old;
  end if;
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists sync_items_lww on public.sync_items;
create trigger sync_items_lww
  before insert or update on public.sync_items
  for each row execute function public.sync_items_last_write_wins();
