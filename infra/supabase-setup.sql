-- What the Supabase project's database needs beyond what Supabase brings along.
-- Applied as a migration; running it again is safe.
--
-- An account holds an e-mail address (in Supabase's own `auth` schema) and,
-- in the two tables below, the stops and places its owner wants on every
-- device. The website reads and writes them directly with the owner's login,
-- so the rules in here are all that stands between one account and another.

-- Favourite stops. `dhid` and `lines` are what service alerts are matched by.
create table if not exists public.favorite_stops (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stop_code text not null check (char_length(stop_code) between 1 and 16),
  dhid text check (char_length(dhid) <= 40),
  lines text[] not null default '{}' check (cardinality(lines) <= 40 and octet_length(lines::text) <= 400),
  added_at timestamptz not null default now(),
  primary key (user_id, stop_code)
);

-- Home and work, each a place as the journey planner knows it.
create table if not exists public.saved_places (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot text not null check (slot in ('home', 'work')),
  place jsonb not null check (jsonb_typeof(place) = 'object' and octet_length(place::text) <= 600),
  primary key (user_id, slot)
);

alter table public.favorite_stops enable row level security;
alter table public.saved_places enable row level security;

-- Someone without a login has no business here; someone with one sees and
-- changes their own rows only.
revoke all on public.favorite_stops, public.saved_places from anon, authenticated;
grant select, insert, update, delete on public.favorite_stops, public.saved_places to authenticated;

drop policy if exists own_rows on public.favorite_stops;
create policy own_rows on public.favorite_stops for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists own_rows on public.saved_places;
create policy own_rows on public.saved_places for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Helpers the Data API must not offer.
create schema if not exists private;

-- An account holds 200 favourites at most. Whoever writes here has a login
-- and nothing else, so this cap and the checks above bound the space an
-- account can take. Runs with the writer's rights, who sees their own rows.
create or replace function private.cap_favourites() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.favorite_stops f where f.user_id = new.user_id and f.stop_code <> new.stop_code) >= 200 then
    raise exception 'too many favourites';
  end if;
  return new;
end $$;
revoke all on function private.cap_favourites() from public;

drop trigger if exists cap on public.favorite_stops;
create trigger cap before insert on public.favorite_stops for each row execute function private.cap_favourites();

-- "Delete my account": removes the caller's account, and with it their rows
-- above, their logins and their sessions. The website holds no key that could
-- delete an account, so the database does it, for the caller only.
create or replace function public.delete_account() returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid())
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Read once an hour by the API server. A free project is paused after a week
-- without requests, and logging in would stop with it.
create table if not exists public.heartbeat (
  id int primary key default 1 check (id = 1),
  note text not null default 'read hourly by the API server'
);
insert into public.heartbeat default values on conflict do nothing;
alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon, authenticated;
grant select on public.heartbeat to anon;
drop policy if exists heartbeat_read on public.heartbeat;
create policy heartbeat_read on public.heartbeat for select to anon using (true);

-- Accounts that nobody uses any more are deleted, once a day. An account
-- counts as unused when its last login is more than 90 days ago and none of
-- its sessions has been renewed since; an open page renews its session by
-- itself. The device keeps its own copy of the favourites and places, so a
-- later login starts a new account with them.
create or replace function private.forget_unused_accounts() returns integer language sql set search_path = '' as $$
  with gone as (
    delete from auth.users u
    where coalesce(u.last_sign_in_at, u.created_at) < now() - interval '90 days'
      and not exists (
        select from auth.sessions s
        where s.user_id = u.id
          and greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'utc') > now() - interval '90 days'
      )
    returning 1
  )
  select count(*)::integer from gone
$$;
revoke all on function private.forget_unused_accounts() from public;

-- The schedule lives in the database, because nothing outside of it holds a
-- key to the accounts. A plain Postgres without pg_cron skips this.
do $$
begin
  if exists (select from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('forget-unused-accounts', '17 3 * * *', 'select private.forget_unused_accounts()');
  end if;
end $$;
