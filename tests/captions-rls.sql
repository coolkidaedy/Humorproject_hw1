-- Local disposable database only, after assignment4.sql. Rolls back all fixtures.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
create function pg_temp.expect_denied(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when insufficient_privilege or check_violation or unique_violation then return;
  end;
  raise exception 'Expected denial: %', statement;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into public.profiles(id,first_name,last_name) values(auth.uid(),'Sam','Student') on conflict(id) do update set id=excluded.id,first_name=excluded.first_name,last_name=excluded.last_name returning avatar_url;
insert into public.captions(user_id,situation,tone,prompt,content,model) values(auth.uid(),'A student in New York','Dry humor','Exact model prompt','A funny caption','test') returning id as caption_id \gset
insert into public.caption_votes(user_id,caption_id,value) values(auth.uid(), :'caption_id', 1);
insert into public.caption_votes(user_id,caption_id,value) values(auth.uid(), :'caption_id', -1) on conflict(user_id,caption_id) do update set user_id=excluded.user_id,caption_id=excluded.caption_id,value=excluded.value;
select pg_temp.expect_denied(format('insert into public.caption_votes(user_id,caption_id,value) values(%L,%L,1)',auth.uid(), :'caption_id'));
select pg_temp.expect_denied(format('insert into public.caption_votes(user_id,caption_id,value) values(%L,%L,1)','22222222-2222-4222-8222-222222222222', :'caption_id'));
select pg_temp.expect_denied('update public.caption_votes set value=2');
select pg_temp.expect_denied('delete from public.caption_votes');
select pg_temp.expect_denied('select prompt from public.captions');
do $$ begin
  if (select count(*) from public.caption_votes) <> 1 then raise exception 'Vote count wrong'; end if;
  if (select value from public.caption_votes) <> -1 then raise exception 'Vote change failed'; end if;
  for i in 1..10 loop if not public.reserve_caption_generation() then raise exception 'Early quota rejection'; end if; end loop;
  if public.reserve_caption_generation() then raise exception 'Quota exceeded'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if (select count(*) from public.caption_votes) <> 0 then raise exception 'Other votes leaked'; end if;
  if (select count(*) from public.profiles) <> 0 then raise exception 'Other profiles leaked'; end if;
  update public.caption_votes set value=1;
  if found then raise exception 'Other vote changed'; end if;
  if not public.reserve_caption_generation() then raise exception 'Quota not per-user'; end if;
end $$;
select pg_temp.expect_denied($q$insert into public.captions(user_id,situation,tone,prompt,content,model) values('11111111-1111-4111-8111-111111111111','A student in New York','Dry humor','Prompt','Caption','test')$q$);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select id, content, situation, tone, created_at from public.captions;
select pg_temp.expect_denied('select * from public.caption_votes');
select pg_temp.expect_denied('select public.reserve_caption_generation()');
select pg_temp.expect_denied($q$insert into public.captions(user_id,situation,tone,prompt,content,model) values('11111111-1111-4111-8111-111111111111','A student in New York','Dry humor','Prompt','Caption','test')$q$);
select pg_temp.expect_denied(format('insert into public.caption_votes(user_id,caption_id,value) values(%L,%L,1)','11111111-1111-4111-8111-111111111111', :'caption_id'));
rollback;
