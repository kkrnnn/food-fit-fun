-- Disposable database only, after the create_score_feedback baseline. No records survive.
begin;
do $$
declare
  player uuid := '11111111-1111-4111-8111-111111111111';
  other_player uuid := '33333333-3333-4333-8333-333333333333';
  run_key uuid := '22222222-2222-4222-8222-222222222222';
  payload jsonb; result text; i integer;
begin
  if (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') <> 2 then raise exception 'Expected exactly two tables'; end if;
  if exists(select 1 from public.score) or exists(select 1 from public.feedback) then raise exception 'Reset did not leave empty tables'; end if;
  payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId',run_key,'outcome','game_over','playerName','QA Player','sex','female','ageYears',10,
    'bmiStart',18.2,'bmiEnd',19.5,'testScore',2,'gameScore',123,'demo',true,'contentVersion','qa-two-tables-v1',
    'startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:01:00Z'));
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'score failed'; end if;
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'retry failed'; end if;
  if (select count(*) from public.score) <> 1 then raise exception 'duplicate score'; end if;
  if not exists(select 1 from public.score where player_name='QA Player' and sex='female' and age_years=10 and bmi_start=18.2 and bmi_end=19.5 and test_score=2 and game_score=123) then raise exception 'Requested fields missing'; end if;
  if public.score_feedback_ingest(player,repeat('b',64),payload) <> 'forbidden' or
    public.score_feedback_ingest(other_player,repeat('c',64),payload) <> 'forbidden' then raise exception 'Ownership failure'; end if;
  payload := jsonb_build_object('kind','feedback','contextRunId',run_key,'rating',5,'occurredAt','2026-10-03T00:01:00Z');
  if public.score_feedback_ingest(other_player,repeat('c',64),payload) <> 'forbidden' then raise exception 'Another player rated'; end if;
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Feedback after cloud reset failed'; end if;
  perform public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{rating}','1'));
  if (select count(*) from public.feedback) <> 1 or
    (select data from public.feedback where player_id=player) <> '{"player_name":"QA Player","stars":5}'::jsonb then raise exception 'JSONB feedback or immutable retry failed'; end if;
  if has_table_privilege('anon','public.score','SELECT') or has_table_privilege('authenticated','public.feedback','INSERT') or
    has_function_privilege('anon','public.score_feedback_ingest(uuid,text,jsonb)','EXECUTE') then raise exception 'Public access'; end if;
  if (select count(*) from pg_class where relnamespace='public'::regnamespace and relkind='r' and relrowsecurity) <> 2 then raise exception 'RLS missing'; end if;
  -- Previous deployed API still works during cutover; retired events do not create a third table.
  payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId','44444444-4444-4444-8444-444444444444','outcome','game_over','ageYearsAtStart',10,'correctCount',1,'score',10,'demo',true,'contentVersion','legacy','startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:01:00Z'));
  if public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64)) <> 'ok' then raise exception 'Legacy API failure'; end if;
  if not exists(select 1 from public.score where player_name is null and bmi_start is null and test_score=1 and game_score=10) then raise exception 'Unknown legacy data invented'; end if;
  if public.analytics_ingest(player,repeat('a',64),'{"kind":"event"}',repeat('b',64)) <> 'ok' then raise exception 'Legacy event acknowledgement failed'; end if;
  -- Invalid data rolls back the whole insert.
  payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId','55555555-5555-4555-8555-555555555555','outcome','game_over','testScore',11,'gameScore',10,'demo',true,'contentVersion','qa','startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:01:00Z'));
  begin
    perform public.score_feedback_ingest(player,repeat('a',64),payload);
    raise exception 'Invalid test score accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.score where id='55555555-5555-4555-8555-555555555555') then raise exception 'Invalid score persisted'; end if;
  for i in 1..59 loop
    payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId',('66666666-6666-4666-8666-'||lpad(i::text,12,'0'))::uuid,'outcome','game_over','gameScore',10,'demo',true,'contentVersion','qa','startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:01:00Z'));
    result:=public.score_feedback_ingest(player,repeat('a',64),payload);
  end loop;
  if result <> 'rate_limited' then raise exception 'New score rate limit missing'; end if;
end $$;
rollback;
