-- Allow each player to publish multiple reconstructions per day.
-- Safe to run repeatedly in the Supabase SQL editor.
begin;

alter table public.night_stories drop constraint if exists night_stories_day_user_id_key;

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
exception when unique_violation then return jsonb_build_object('error','That handle is already taken. Choose another.');
end $$;

create or replace function public.night_submit_story(story_title text, story_body text, player_alias text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/New_York')::date;
begin
  if uid is null then return jsonb_build_object('error','Sign in to post your story.'); end if;
  if not exists(select 1 from public.night_runs where day=d and user_id=uid and finished) then return jsonb_build_object('error','Finish the mystery before writing its ending.'); end if;
  if story_title is null or story_body is null or player_alias is null or char_length(trim(story_title)) not between 3 and 80 or char_length(trim(story_body)) not between 80 and 1200 or player_alias !~ '^[a-zA-Z0-9_]{3,20}$' then return jsonb_build_object('error','Check your title, story length and handle.'); end if;
  if exists(select 1 from public.night_players where lower(alias)=lower(player_alias) and user_id<>uid) then return jsonb_build_object('error','That handle is taken. Choose another.'); end if;
  insert into public.night_players(user_id,alias) values(uid,player_alias) on conflict(user_id) do update set alias=excluded.alias;
  insert into public.night_stories(day,user_id,title,body,source_kind) values(d,uid,trim(story_title),trim(story_body),'daily');
  return jsonb_build_object('success',true);
exception when unique_violation then return jsonb_build_object('error','That handle is already taken. Choose another.');
end $$;

commit;
