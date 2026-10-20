-- Public story feed with multiple posts per player and one vote per player per day. Safe to run repeatedly.
begin;

create table if not exists public.night_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text not null check (alias ~ '^[a-zA-Z0-9_]{3,20}$')
);
create unique index if not exists night_alias_unique on public.night_players (lower(alias));

create table if not exists public.night_stories (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 80 and 1200),
  source_kind text not null default 'generated' check (source_kind in ('daily','generated')),
  created_at timestamptz not null default now(),
  unique(id,day)
);

create table if not exists public.night_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  story_id uuid not null,
  primary key(user_id,day),
  foreign key(story_id,day) references public.night_stories(id,day) on delete cascade
);
create index if not exists night_votes_story_idx on public.night_votes(story_id);

alter table public.night_players enable row level security;
alter table public.night_stories enable row level security;
alter table public.night_votes enable row level security;
revoke all on public.night_players,public.night_stories,public.night_votes from public,anon,authenticated;

create or replace function public.night_submit_generated_story(story_title text,story_body text,player_alias text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date;
begin
  if uid is null then return jsonb_build_object('error','Sign in to post your story.'); end if;
  if story_title is null or story_body is null or player_alias is null or char_length(trim(story_title)) not between 3 and 80 or char_length(trim(story_body)) not between 80 and 1200 or player_alias !~ '^[a-zA-Z0-9_]{3,20}$' then return jsonb_build_object('error','Check your title, story length and handle.'); end if;
  if exists(select 1 from public.night_players where lower(alias)=lower(player_alias) and user_id<>uid) then return jsonb_build_object('error','That handle is taken. Choose another.'); end if;
  insert into public.night_players(user_id,alias) values(uid,player_alias) on conflict(user_id) do update set alias=excluded.alias;
  insert into public.night_stories(day,user_id,title,body,source_kind) values(d,uid,trim(story_title),trim(story_body),'generated');
  return jsonb_build_object('success',true);
exception when unique_violation then return jsonb_build_object('error','This story or handle already exists. Refresh and try again.');
end $$;

create or replace function public.night_submit_story(story_title text,story_body text,player_alias text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date;
begin
  if uid is null then return jsonb_build_object('error','Sign in to post your story.'); end if;
  if story_title is null or story_body is null or player_alias is null or char_length(trim(story_title)) not between 3 and 80 or char_length(trim(story_body)) not between 80 and 1200 or player_alias !~ '^[a-zA-Z0-9_]{3,20}$' then return jsonb_build_object('error','Check your title, story length and handle.'); end if;
  if exists(select 1 from public.night_players where lower(alias)=lower(player_alias) and user_id<>uid) then return jsonb_build_object('error','That handle is taken. Choose another.'); end if;
  insert into public.night_players(user_id,alias) values(uid,player_alias) on conflict(user_id) do update set alias=excluded.alias;
  insert into public.night_stories(day,user_id,title,body,source_kind) values(d,uid,trim(story_title),trim(story_body),'daily');
  return jsonb_build_object('success',true);
exception when unique_violation then return jsonb_build_object('error','This story or handle already exists. Refresh and try again.');
end $$;

create or replace function public.night_vote(story_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; s public.night_stories;
begin
  if uid is null then return jsonb_build_object('error','Sign in to vote.'); end if;
  select * into s from public.night_stories where id=story_id and day=d;
  if not found then return jsonb_build_object('error','Voting for this story has closed.'); end if;
  if s.user_id=uid then return jsonb_build_object('error','You cannot vote for your own story.'); end if;
  insert into public.night_votes(user_id,day,story_id) values(uid,d,s.id) on conflict(user_id,day) do update set story_id=excluded.story_id;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.night_community(requested_day date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stories jsonb; leaders jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into stories from (
    select s.id,p.alias,s.title,s.body,s.day,s.source_kind as "sourceKind",(s.user_id=uid) as mine,
      (select count(*) from public.night_votes v where v.story_id=s.id) as votes,
      exists(select 1 from public.night_votes v where v.story_id=s.id and v.user_id=uid) as voted,
      false as playable
    from public.night_stories s join public.night_players p on p.user_id=s.user_id
    where s.day=requested_day order by s.created_at desc limit 100
  ) x;
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into leaders from (
    select p.alias,count(v.story_id)*50 as points,0 as nights,count(v.story_id) as votes,(p.user_id=uid) as mine
    from public.night_players p left join public.night_stories s on s.user_id=p.user_id left join public.night_votes v on v.story_id=s.id
    group by p.user_id,p.alias order by points desc,p.alias limit 50
  ) x;
  return jsonb_build_object('stories',stories,'leaders',leaders,'dailyLeaders',leaders);
end $$;

revoke all on function public.night_submit_generated_story(text,text,text),public.night_submit_story(text,text,text),public.night_vote(uuid),public.night_community(date) from public,anon,authenticated;
grant execute on function public.night_submit_generated_story(text,text,text),public.night_submit_story(text,text,text),public.night_vote(uuid) to authenticated;
grant execute on function public.night_community(date) to anon,authenticated;

commit;
