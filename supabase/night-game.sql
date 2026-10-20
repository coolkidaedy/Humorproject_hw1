-- Additive, rerunnable migration. Run with an owner role in the Supabase SQL editor.
-- All competitive mutations go through atomic functions; clients cannot edit scores.
begin;
create table if not exists public.night_episodes (
  day date primary key,
  title text not null,
  brief text not null,
  answer text not null,
  aliases text[] not null,
  explanation text not null,
  source text not null,
  clues jsonb not null check (jsonb_typeof(clues) = 'array' and jsonb_array_length(clues) = 4),
  created_at timestamptz not null default now()
);
create table if not exists public.night_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text not null check (alias ~ '^[a-zA-Z0-9_]{3,20}$')
);
create unique index if not exists night_alias_unique on public.night_players (lower(alias));
create table if not exists public.night_runs (
  day date not null references public.night_episodes(day),
  user_id uuid not null references auth.users(id) on delete cascade,
  revealed integer not null default 1 check (revealed between 1 and 4),
  wrong integer not null default 0 check (wrong between 0 and 3),
  finished boolean not null default false,
  solved boolean not null default false,
  score integer not null default 0 check (score between 0 and 1000),
  guesses jsonb not null default '[]'::jsonb,
  primary key (day, user_id)
);
alter table public.night_runs add column if not exists guesses jsonb not null default '[]'::jsonb;

create table if not exists public.night_stories (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  user_id uuid not null,
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 80 and 1200),
  created_at timestamptz not null default now(),
  unique(id, day),
  foreign key (day, user_id) references public.night_runs(day, user_id) on delete cascade
);
create table if not exists public.night_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  story_id uuid not null,
  primary key (user_id, day),
  foreign key (story_id, day) references public.night_stories(id, day) on delete cascade
);
create index if not exists night_votes_story_idx on public.night_votes(story_id);
create table if not exists public.night_story_cases (
  story_id uuid primary key references public.night_stories(id) on delete cascade,
  generated_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  brief text not null check (char_length(brief) between 20 and 220),
  answer text not null check (char_length(answer) between 2 and 100),
  aliases text[] not null check (array_length(aliases,1) between 2 and 6),
  explanation text not null check (char_length(explanation) between 30 and 500),
  clues jsonb not null check (jsonb_typeof(clues)='array' and jsonb_array_length(clues)=4),
  created_at timestamptz not null default now()
);
create table if not exists public.night_story_case_runs (
  story_id uuid not null references public.night_story_cases(story_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revealed integer not null default 1 check (revealed between 1 and 4),
  wrong integer not null default 0 check (wrong between 0 and 3),
  finished boolean not null default false,
  solved boolean not null default false,
  score integer not null default 0 check (score between 0 and 1000),
  guesses jsonb not null default '[]'::jsonb,
  primary key(story_id,user_id)
);
create table if not exists public.night_case_generations (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempts integer not null check (attempts between 1 and 3),
  primary key(day,user_id)
);
alter table public.night_episodes enable row level security;
alter table public.night_players enable row level security;
alter table public.night_runs enable row level security;
alter table public.night_stories enable row level security;
alter table public.night_votes enable row level security;
alter table public.night_story_cases enable row level security;
alter table public.night_story_case_runs enable row level security;
alter table public.night_case_generations enable row level security;
revoke all on public.night_episodes, public.night_players, public.night_runs, public.night_stories, public.night_votes, public.night_story_cases, public.night_story_case_runs, public.night_case_generations from public, anon, authenticated;
grant all on public.night_episodes to service_role;

create or replace function public.night_play(action_name text default 'state', guess_text text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); d date := (now() at time zone 'America/New_York')::date;
  e public.night_episodes; r public.night_runs; matched boolean; output jsonb;
begin
  if uid is null then return jsonb_build_object('error', 'Sign in to play the ranked daily.'); end if;
  if action_name is null or action_name not in ('state','reveal','guess','giveup') then return jsonb_build_object('error','Invalid move.'); end if;
  select * into e from public.night_episodes where day = d;
  if not found then return jsonb_build_object('error', 'Tonight’s live case is not ready yet.'); end if;
  insert into public.night_runs(day,user_id) values(d,uid) on conflict do nothing;
  select * into r from public.night_runs where day=d and user_id=uid for update;
  if not r.finished then
    if action_name = 'reveal' then r.revealed := least(4,r.revealed+1); end if;
    if action_name = 'giveup' then r.finished := true; end if;
    if action_name = 'guess' then
      if guess_text is null or char_length(trim(guess_text)) not between 1 and 120 then return jsonb_build_object('error','Enter a place name.'); end if;
      select exists(select 1 from unnest(e.aliases) a where regexp_replace(lower(a),'[^a-z0-9]','','g') = regexp_replace(lower(guess_text),'[^a-z0-9]','','g')) into matched;
      r.guesses := r.guesses || jsonb_build_array(jsonb_build_object('place',trim(guess_text),'clueCount',r.revealed,'correct',matched));
      if matched then r.solved:=true; r.finished:=true;
      else r.wrong:=r.wrong+1; r.finished:=r.wrong>=3; end if;
    end if;
    r.score := case when r.solved then greatest(100,1000-(r.revealed-1)*200-r.wrong*100) else 0 end;
    update public.night_runs set guesses=r.guesses,revealed=r.revealed,wrong=r.wrong,finished=r.finished,solved=r.solved,score=r.score where day=d and user_id=uid;
  end if;
  select jsonb_build_object('day',d,'title',e.title,'brief',e.brief,'number',(d-date '2026-10-12'),'mode','live',
    'clues',(select jsonb_agg(value order by ordinality) from jsonb_array_elements(e.clues) with ordinality where ordinality<=case when r.finished then 4 else r.revealed end),
    'guesses',r.guesses,'revealed',r.revealed,'wrong',r.wrong,'finished',r.finished,'solved',r.solved,'score',r.score) into output;
  if r.finished then output := output || jsonb_build_object('answer',e.answer,'explanation',e.explanation,'source',e.source); end if;
  return output;
end $$;

create or replace function public.night_submit_story(story_title text, story_body text, player_alias text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date;
begin
  if uid is null then return jsonb_build_object('error','Sign in to publish your story.'); end if;
  if not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish the mystery before writing its ending.'); end if;
  if story_title is null or story_body is null or player_alias is null or char_length(trim(story_title)) not between 3 and 80 or char_length(trim(story_body)) not between 80 and 1200 or player_alias !~ '^[a-zA-Z0-9_]{3,20}$' then return jsonb_build_object('error','Check your title, story length and handle.'); end if;
  if exists(select 1 from public.night_players where lower(alias)=lower(player_alias) and user_id<>uid) then return jsonb_build_object('error','That handle is taken. Choose another.'); end if;
  insert into public.night_players(user_id,alias) values(uid,player_alias) on conflict(user_id) do update set alias=excluded.alias;
  insert into public.night_stories(day,user_id,title,body) values(d,uid,trim(story_title),trim(story_body));
  return jsonb_build_object('success',true);
exception when unique_violation then return jsonb_build_object('error','This story or handle already exists. Refresh and try again.');
end $$;

create or replace function public.night_vote(story_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; s public.night_stories;
begin
  if uid is null then return jsonb_build_object('error','Sign in to vote.'); end if;
  if not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish today’s case to unlock the stories.'); end if;
  select * into s from public.night_stories where id=story_id and day=d;
  if not found then return jsonb_build_object('error','Voting for this story has closed.'); end if;
  if s.user_id=uid then return jsonb_build_object('error','Give another storyteller their moment. You cannot vote for yourself.'); end if;
  insert into public.night_votes(user_id,day,story_id) values(uid,d,s.id) on conflict(user_id,day) do update set story_id=excluded.story_id;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.night_community(requested_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; stories jsonb:='[]'; leaders jsonb; daily_leaders jsonb;
begin
  -- Today's stories contain spoilers. Only completed players can read them.
  if requested_day < d or exists(select 1 from public.night_runs where day=requested_day and user_id=uid and finished) then
    select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into stories from (
      select s.id,p.alias,s.title,s.body,s.day,(s.user_id=uid) as mine,
        (select count(*) from public.night_votes v where v.story_id=s.id) as votes,
        exists(select 1 from public.night_votes v where v.story_id=s.id and v.user_id=uid) as voted,
        exists(select 1 from public.night_story_cases c where c.story_id=s.id) as playable
      from public.night_stories s join public.night_players p on p.user_id=s.user_id
      where s.day=requested_day order by md5(s.id::text || coalesce(uid::text,'guest')) limit 100
    ) x;
  end if;
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into leaders from (
    select p.alias,coalesce(r.points,0)+coalesce(v.votes,0)*50 as points,coalesce(r.nights,0) as nights,coalesce(v.votes,0) as votes,(p.user_id=uid) as mine
    from public.night_players p
    left join (select user_id,sum(score) as points,count(*) filter(where finished) as nights from public.night_runs group by user_id) r on r.user_id=p.user_id
    left join (select s.user_id,count(*) as votes from public.night_votes nv join public.night_stories s on s.id=nv.story_id group by s.user_id) v on v.user_id=p.user_id
    order by points desc, nights desc, p.alias asc limit 50
  ) x;
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into daily_leaders from (
    select p.alias,r.score+coalesce(v.votes,0)*50 as points,1 as nights,coalesce(v.votes,0) as votes,(p.user_id=uid) as mine
    from public.night_players p join public.night_runs r on r.user_id=p.user_id and r.day=requested_day and r.finished
    left join (select s.user_id,count(*) as votes from public.night_votes nv join public.night_stories s on s.id=nv.story_id where s.day=requested_day group by s.user_id) v on v.user_id=p.user_id
    order by points desc,p.alias asc limit 50
  ) x;
  return jsonb_build_object('stories',stories,'leaders',leaders,'dailyLeaders',daily_leaders);
end $$;
revoke all on function public.night_play(text,text), public.night_submit_story(text,text,text), public.night_vote(uuid), public.night_community(date) from public, anon, authenticated;
grant execute on function public.night_play(text,text), public.night_submit_story(text,text,text), public.night_vote(uuid) to authenticated;
grant execute on function public.night_community(date) to anon, authenticated;

create or replace function public.night_story_case_source(source_story_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; s public.night_stories; author text;
begin
  if uid is null then return jsonb_build_object('error','Sign in to turn stories into games.'); end if;
  select * into s from public.night_stories where id=source_story_id;
  if not found then return jsonb_build_object('error','This story is unavailable.'); end if;
  if s.day=d and not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish today’s daily before opening its community stories.'); end if;
  if exists(select 1 from public.night_story_cases where story_id=source_story_id) then return jsonb_build_object('ready',true); end if;
  select alias into author from public.night_players where user_id=s.user_id;
  return jsonb_build_object('ready',false,'id',s.id,'alias',author,'title',s.title,'body',s.body);
end $$;

create or replace function public.night_reserve_case_generation() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; used integer;
begin
  if uid is null then return jsonb_build_object('error','Sign in to generate a community case.'); end if;
  insert into public.night_case_generations(day,user_id,attempts) values(d,uid,1)
    on conflict(day,user_id) do update set attempts=public.night_case_generations.attempts+1
    where public.night_case_generations.attempts<3 returning attempts into used;
  if used is null then return jsonb_build_object('error','You’ve generated three community cases today. Play one that is already open.'); end if;
  return jsonb_build_object('remaining',3-used);
end $$;

create or replace function public.night_save_story_case(source_story_id uuid, case_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; s public.night_stories; alias_values text[];
begin
  if uid is null then return jsonb_build_object('error','Sign in to save a community case.'); end if;
  select * into s from public.night_stories where id=source_story_id;
  if not found then return jsonb_build_object('error','This story is unavailable.'); end if;
  if s.day=d and not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish today’s daily before opening its community stories.'); end if;
  if case_payload is null or jsonb_typeof(case_payload)<>'object' or jsonb_typeof(case_payload->'aliases')<>'array' or jsonb_typeof(case_payload->'clues')<>'array' or jsonb_array_length(case_payload->'clues')<>4 then return jsonb_build_object('error','The generated case is incomplete.'); end if;
  select array_agg(trim(value)) into alias_values from jsonb_array_elements_text(case_payload->'aliases');
  if char_length(trim(case_payload->>'title')) not between 3 and 80 or char_length(trim(case_payload->>'brief')) not between 20 and 220 or char_length(trim(case_payload->>'answer')) not between 2 and 100 or char_length(trim(case_payload->>'explanation')) not between 30 and 500 or array_length(alias_values,1) not between 2 and 6 then return jsonb_build_object('error','The generated case did not fit the game.'); end if;
  insert into public.night_story_cases(story_id,generated_by,title,brief,answer,aliases,explanation,clues)
    values(source_story_id,uid,trim(case_payload->>'title'),trim(case_payload->>'brief'),trim(case_payload->>'answer'),alias_values,trim(case_payload->>'explanation'),case_payload->'clues')
    on conflict(story_id) do nothing;
  return jsonb_build_object('success',true);
exception when check_violation then return jsonb_build_object('error','The generated case did not fit the game.');
end $$;

create or replace function public.night_story_case_play(source_story_id uuid, action_name text default 'state', guess_text text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; c public.night_story_cases; r public.night_story_case_runs; s public.night_stories; author text; matched boolean; output jsonb;
begin
  if uid is null then return jsonb_build_object('error','Sign in to play community cases.'); end if;
  if action_name is null or action_name not in ('state','reveal','guess','giveup') then return jsonb_build_object('error','Invalid move.'); end if;
  select * into c from public.night_story_cases where story_id=source_story_id;
  if not found then return jsonb_build_object('error','This story has not become a game yet.'); end if;
  select * into s from public.night_stories where id=source_story_id;
  if s.day=d and not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish today’s daily before playing its community cases.'); end if;
  select alias into author from public.night_players where user_id=s.user_id;
  insert into public.night_story_case_runs(story_id,user_id) values(source_story_id,uid) on conflict do nothing;
  select * into r from public.night_story_case_runs where story_id=source_story_id and user_id=uid for update;
  if not r.finished then
    if action_name='reveal' then r.revealed:=least(4,r.revealed+1); end if;
    if action_name='giveup' then r.finished:=true; end if;
    if action_name='guess' then
      if guess_text is null or char_length(trim(guess_text)) not between 1 and 120 then return jsonb_build_object('error','Enter a place name.'); end if;
      select exists(select 1 from unnest(c.aliases) a where regexp_replace(lower(a),'[^a-z0-9]','','g')=regexp_replace(lower(guess_text),'[^a-z0-9]','','g')) into matched;
      r.guesses:=r.guesses||jsonb_build_array(jsonb_build_object('place',trim(guess_text),'clueCount',r.revealed,'correct',matched));
      if matched then r.solved:=true; r.finished:=true; else r.wrong:=r.wrong+1; r.finished:=r.wrong>=3; end if;
    end if;
    r.score:=case when r.solved then greatest(100,1000-(r.revealed-1)*200-r.wrong*100) else 0 end;
    update public.night_story_case_runs set revealed=r.revealed,wrong=r.wrong,finished=r.finished,solved=r.solved,score=r.score,guesses=r.guesses where story_id=source_story_id and user_id=uid;
  end if;
  select jsonb_build_object('storyId',source_story_id,'storyTitle',s.title,'author',author,'title',c.title,'brief',c.brief,
    'clues',(select jsonb_agg(value order by ordinality) from jsonb_array_elements(c.clues) with ordinality where ordinality<=case when r.finished then 4 else r.revealed end),
    'guesses',r.guesses,'revealed',r.revealed,'wrong',r.wrong,'finished',r.finished,'solved',r.solved,'score',r.score) into output;
  if r.finished then output:=output||jsonb_build_object('answer',c.answer,'explanation',c.explanation); end if;
  return output;
end $$;

revoke all on function public.night_story_case_source(uuid), public.night_reserve_case_generation(), public.night_save_story_case(uuid,jsonb), public.night_story_case_play(uuid,text,text) from public, anon, authenticated;
grant execute on function public.night_story_case_source(uuid), public.night_reserve_case_generation(), public.night_save_story_case(uuid,jsonb), public.night_story_case_play(uuid,text,text) to authenticated;

-- A shared per-account daily budget also covers practice stories.
create table if not exists public.night_story_generations (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempts integer not null check (attempts between 1 and 5),
  primary key(day,user_id)
);
alter table public.night_story_generations enable row level security;
revoke all on public.night_story_generations from public, anon, authenticated;
create or replace function public.night_reserve_story_generation() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; used integer;
begin
  if uid is null then return jsonb_build_object('error','Sign in to generate your story.'); end if;
  insert into public.night_story_generations(day,user_id,attempts) values(d,uid,1)
    on conflict(day,user_id) do update set attempts=public.night_story_generations.attempts+1
    where public.night_story_generations.attempts<5 returning attempts into used;
  if used is null then return jsonb_build_object('error','You’ve used today’s five AI drafts. You can still edit your story.'); end if;
  return jsonb_build_object('remaining',5-used);
end $$;
revoke all on function public.night_reserve_story_generation() from public, anon, authenticated;
grant execute on function public.night_reserve_story_generation() to authenticated;

commit;
