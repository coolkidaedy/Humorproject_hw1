-- Run in the existing project's Supabase SQL Editor. Transactional and rerunnable.
-- Replaces policies on the four named app tables; preserves rows and auth triggers.
begin;
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  situation text not null check (char_length(situation) between 10 and 600),
  tone text not null check (tone in ('Dry humor', 'Chronically online', 'Midwest meets NYC')),
  prompt text not null check (char_length(prompt) between 1 and 3000),
  content text not null check (char_length(content) between 1 and 1000),
  model text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.caption_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption_id uuid not null references public.captions(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (user_id, caption_id)
);
create index if not exists captions_feed_idx on public.captions (created_at desc, id desc);
create index if not exists captions_user_idx on public.captions (user_id);
create index if not exists caption_votes_caption_idx on public.caption_votes (caption_id);
create table if not exists public.caption_generation_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  attempts integer not null check (attempts between 1 and 10),
  primary key (user_id, day)
);
alter table public.caption_generation_limits enable row level security;
revoke all on public.caption_generation_limits from public, anon, authenticated;

-- This narrowly scoped function permits only spending the caller's quota.
create or replace function public.reserve_caption_generation() returns boolean
language plpgsql security definer set search_path = '' as $$
declare reserved integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.caption_generation_limits (user_id, day, attempts)
  values (auth.uid(), (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, day) do update
    set attempts = public.caption_generation_limits.attempts + 1
    where public.caption_generation_limits.attempts < 10
  returning attempts into reserved;
  return reserved is not null;
end;
$$;
revoke all on function public.reserve_caption_generation() from public, anon;
grant execute on function public.reserve_caption_generation() to authenticated;

-- Remove permissive legacy policies; PostgreSQL otherwise combines them with OR.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('restaurants','profiles','captions','caption_votes')
  loop execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename); end loop;
end $$;
alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;
revoke all on public.restaurants, public.profiles, public.captions, public.caption_votes from public, anon, authenticated;
grant select on public.restaurants to anon, authenticated;
create policy restaurants_read on public.restaurants for select to anon, authenticated using (true);
-- Column grants prevent profile forms from changing unrelated fields (e.g. roles).
grant select (id, first_name, last_name, avatar_url), insert (id, first_name, last_name, avatar_url), update (id, first_name, last_name, avatar_url) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- Public feed never needs internal owner IDs or the full model prompt.
grant select (id, situation, tone, content, created_at) on public.captions to anon, authenticated;
grant insert (user_id, situation, tone, prompt, content, model) on public.captions to authenticated;
create policy captions_read on public.captions for select to anon, authenticated using (true);
create policy captions_insert on public.captions for insert to authenticated with check ((select auth.uid()) = user_id);
grant select on public.caption_votes to authenticated;
grant insert (user_id, caption_id, value), update (user_id, caption_id, value) on public.caption_votes to authenticated;
create policy votes_read on public.caption_votes for select to authenticated using ((select auth.uid()) = user_id);
create policy votes_insert on public.caption_votes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy votes_update on public.caption_votes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Upsert includes ID columns. A trigger makes those immutable during updates.
create or replace function public.keep_vote_identity() returns trigger
language plpgsql set search_path = '' as $$ begin
  if new.user_id is distinct from old.user_id or new.caption_id is distinct from old.caption_id then
    raise exception 'Vote identity cannot change';
  end if;
  return new;
end $$;
revoke all on function public.keep_vote_identity() from public, anon, authenticated;
drop trigger if exists keep_vote_identity on public.caption_votes;
create trigger keep_vote_identity before update on public.caption_votes for each row execute function public.keep_vote_identity();
commit;

-- Inventory: review EVERY additional app table returned here before submitting.
-- Do not alter Supabase-managed auth/storage schemas indiscriminately.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') order by c.relname;
