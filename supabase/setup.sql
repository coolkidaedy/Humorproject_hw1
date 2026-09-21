-- Run once in your project's Supabase SQL Editor.
-- Public restaurant listings: visitors may read but cannot modify them.
-- This creates a separate table and does not remove any existing jokes table.
begin;
create table public.restaurants (
  id bigint generated always as identity primary key,
  name text not null,
  neighborhood text not null,
  cuisine text not null,
  created_at timestamptz not null default now()
);
alter table public.restaurants enable row level security;
revoke all on public.restaurants from anon, authenticated;
grant select on public.restaurants to anon, authenticated;
create policy "Anyone can read restaurants"
  on public.restaurants for select to anon, authenticated using (true);
-- Sources: https://katzsdelicatessen.com/address
-- https://lindustrie-bk.myshopify.com/ and https://www.xianfoods.com/locations
insert into public.restaurants (name, neighborhood, cuisine) values
  ('Katz''s Delicatessen', 'Lower East Side, Manhattan', 'Jewish deli'),
  ('L''Industrie Pizzeria', 'Williamsburg, Brooklyn', 'Pizza'),
  ('Xi''an Famous Foods', 'Upper East Side, Manhattan', 'Chinese');
commit;
