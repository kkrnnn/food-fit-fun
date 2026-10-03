-- Run only against a disposable database after the migration. Tests leave no records.
begin;
do $$
declare
  player uuid := '11111111-1111-4111-8111-111111111111';
  other_player uuid := '33333333-3333-4333-8333-333333333333';
  run_key uuid; payload jsonb; result text; i integer;
begin
  for i in 1..3 loop
    run_key := ('22222222-2222-4222-8222-' || lpad(i::text,12,'0'))::uuid;
    payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId',run_key,'outcome','game_over','score',100,'demo',true,
      'startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:03:00Z','answers',jsonb_build_array(jsonb_build_object('index',0))));
    result := public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64));
    if result <> 'ok' then raise exception 'run insert failed: %',result; end if;
    result := public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64));
    if result <> 'ok' then raise exception 'retry failed'; end if;
  end loop;
  if (select count(*) from public.analytics_runs) <> 3 or (select count(*) from public.analytics_answers) <> 3 then raise exception 'duplicate run/answers'; end if;
  result := public.analytics_ingest(player,repeat('c',64),payload,repeat('b',64));
  if result <> 'forbidden' then raise exception 'wrong credential accepted'; end if;
  result := public.analytics_ingest(other_player,repeat('d',64),payload,repeat('b',64));
  if result <> 'forbidden' then raise exception 'another player overwrote run'; end if;
  payload := jsonb_build_object('kind','feedback','contextRunId',run_key,'surveyVersion','enjoyment-v1','rating',5,'eligibleRunCount',3,'occurredAt','2026-10-03T00:03:00Z');
  if public.analytics_ingest(other_player,repeat('d',64),payload,repeat('b',64)) <> 'forbidden' then raise exception 'another player rated run'; end if;
  if public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64)) <> 'ok' then raise exception 'feedback failed'; end if;
  if public.analytics_ingest(player,repeat('a',64),jsonb_set(payload,'{rating}','1'),repeat('b',64)) <> 'ok' then raise exception 'feedback retry failed'; end if;
  if (select count(*) from public.player_feedback) <> 1 or (select rating from public.player_feedback where player_id=player) <> 5 then raise exception 'feedback retry overwrote rating'; end if;
  payload := jsonb_build_object('kind','event','eventId','44444444-4444-4444-8444-444444444444','contextRunId',run_key,'surveyVersion','enjoyment-v1','event','shown','occurredAt','2026-10-03T00:03:00Z');
  perform public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64));
  perform public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64));
  if (select count(*) from public.feedback_events) <> 1 then raise exception 'duplicate impression'; end if;
  if has_table_privilege('anon','public.analytics_run_report','SELECT') or has_table_privilege('authenticated','public.player_feedback','SELECT') or
    has_function_privilege('anon','public.analytics_ingest(uuid,text,jsonb,text)','EXECUTE') then raise exception 'public privileges leaked'; end if;
  if (select count(*) from pg_class where relname in ('analytics_players','analytics_runs','analytics_answers','player_feedback','feedback_events','analytics_rate_limits') and relrowsecurity) <> 6 then raise exception 'RLS missing'; end if;
  -- An answer constraint failure must also roll back its parent run.
  run_key := '55555555-5555-4555-8555-555555555555';
  payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId',run_key,'outcome','game_over','score',100,'demo',true,
    'startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:03:00Z','answers',jsonb_build_array(jsonb_build_object('index',11))));
  begin
    perform public.analytics_ingest(player,repeat('a',64),payload,repeat('b',64));
    raise exception 'invalid answer accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.analytics_runs where run_id=run_key) then raise exception 'partial run persisted'; end if;
  for i in 1..61 loop
    result := public.analytics_ingest(player,repeat('a',64),jsonb_build_object('kind','feedback','contextRunId','22222222-2222-4222-8222-000000000003','surveyVersion','enjoyment-v1','rating',4,'eligibleRunCount',3,'occurredAt','2026-10-03T00:03:00Z'),repeat('b',64));
  end loop;
  if result <> 'rate_limited' then raise exception 'rate limit missing'; end if;
end $$;
rollback;
