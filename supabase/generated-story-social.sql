-- Let stories from Gemini-generated cases join the same daily feed and voting loop.
begin;

alter table public.night_stories drop constraint if exists night_stories_day_user_id_fkey;
alter table public.night_stories drop constraint if exists night_stories_day_user_id_key;
alter table public.night_stories add column if not exists source_kind text not null default 'daily';
alter table public.night_stories drop constraint if exists night_stories_source_kind_check;
alter table public.night_stories add constraint night_stories_source_kind_check check (source_kind in ('daily','generated'));

create or replace function public.night_submit_generated_story(story_title text, story_body text, player_alias text) returns jsonb
language plpgsql security definer set search_path = '' as $$
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

create or replace function public.night_vote(story_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; s public.night_stories;
begin
  if uid is null then return jsonb_build_object('error','Sign in to vote.'); end if;
  select * into s from public.night_stories where id=story_id and day=d;
  if not found then return jsonb_build_object('error','Voting for this story has closed.'); end if;
  if s.source_kind='daily' and not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish today’s daily before voting on its stories.'); end if;
  if s.user_id=uid then return jsonb_build_object('error','Give another storyteller their moment. You cannot vote for yourself.'); end if;
  insert into public.night_votes(user_id,day,story_id) values(uid,d,s.id) on conflict(user_id,day) do update set story_id=excluded.story_id;
  return jsonb_build_object('success',true);
end $$;

create or replace function public.night_community(requested_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; stories jsonb:='[]'; leaders jsonb; daily_leaders jsonb; daily_unlocked boolean;
begin
  daily_unlocked := requested_day<d or exists(select 1 from public.night_runs where day=requested_day and user_id=uid and finished);
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into stories from (
    select s.id,p.alias,s.title,s.body,s.day,s.source_kind as "sourceKind",(s.user_id=uid) as mine,
      (select count(*) from public.night_votes v where v.story_id=s.id) as votes,
      exists(select 1 from public.night_votes v where v.story_id=s.id and v.user_id=uid) as voted,
      exists(select 1 from public.night_story_cases c where c.story_id=s.id) as playable
    from public.night_stories s join public.night_players p on p.user_id=s.user_id
    where s.day=requested_day and (s.source_kind='generated' or daily_unlocked)
    order by md5(s.id::text || coalesce(uid::text,'guest')) limit 100
  ) x;
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into leaders from (
    select p.alias,coalesce(r.points,0)+coalesce(v.votes,0)*50 as points,coalesce(r.nights,0) as nights,coalesce(v.votes,0) as votes,(p.user_id=uid) as mine
    from public.night_players p
    left join (select user_id,sum(score) as points,count(*) filter(where finished) as nights from public.night_runs group by user_id) r on r.user_id=p.user_id
    left join (select s.user_id,count(*) as votes from public.night_votes nv join public.night_stories s on s.id=nv.story_id group by s.user_id) v on v.user_id=p.user_id
    order by points desc,nights desc,p.alias asc limit 50
  ) x;
  select coalesce(jsonb_agg(row_to_json(x)),'[]'::jsonb) into daily_leaders from (
    select p.alias,coalesce(r.score,0)+coalesce(v.votes,0)*50 as points,case when r.finished then 1 else 0 end as nights,coalesce(v.votes,0) as votes,(p.user_id=uid) as mine
    from public.night_players p
    left join public.night_runs r on r.user_id=p.user_id and r.day=requested_day and r.finished
    left join (select s.user_id,count(*) as votes from public.night_votes nv join public.night_stories s on s.id=nv.story_id where s.day=requested_day group by s.user_id) v on v.user_id=p.user_id
    where r.finished or exists(select 1 from public.night_stories s where s.day=requested_day and s.user_id=p.user_id)
    order by points desc,p.alias asc limit 50
  ) x;
  return jsonb_build_object('stories',stories,'leaders',leaders,'dailyLeaders',daily_leaders);
end $$;

create or replace function public.night_story_case_source(source_story_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date; s public.night_stories; author text;
begin
  if uid is null then return jsonb_build_object('error','Sign in to turn stories into games.'); end if;
  select * into s from public.night_stories where id=source_story_id;
  if not found then return jsonb_build_object('error','This story is unavailable.'); end if;
  if s.source_kind='daily' and s.day=d and not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish today’s daily before opening its community stories.'); end if;
  if exists(select 1 from public.night_story_cases where story_id=source_story_id) then return jsonb_build_object('ready',true); end if;
  select alias into author from public.night_players where user_id=s.user_id;
  return jsonb_build_object('ready',false,'id',s.id,'alias',author,'title',s.title,'body',s.body);
end $$;

revoke all on function public.night_submit_generated_story(text,text,text),public.night_vote(uuid),public.night_community(date),public.night_story_case_source(uuid) from public,anon,authenticated;
grant execute on function public.night_submit_generated_story(text,text,text) to authenticated;
grant execute on function public.night_vote(uuid),public.night_community(date),public.night_story_case_source(uuid) to authenticated;
grant execute on function public.night_community(date) to anon;

commit;
