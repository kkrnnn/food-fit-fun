-- Disposable PostgreSQL only. Apply both migrations first; fixtures roll back.
begin;
do $$
declare
  player uuid := '77777777-7777-4777-8777-777777777777';
  run_key uuid := '88888888-8888-4888-8888-888888888888';
  payload jsonb;
begin
  payload := jsonb_build_object('kind','run','run',jsonb_build_object('runId',run_key,'outcome','game_over','playerName','QA Comment','sex','female','ageYears',20,'bmiStart',22,'bmiEnd',23,'testScore',2,'gameScore',100,'demo',true,'contentVersion','qa-comment','startedAt','2026-10-03T00:00:00Z','endedAt','2026-10-03T00:01:00Z'));
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Score failed'; end if;
  payload := jsonb_build_object('kind','feedback','contextRunId',run_key,'rating',4,'comment','  เพิ่มอาหาร 🍎  ','occurredAt','2026-10-03T00:01:00Z');
  if public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{comment}','null')) <> 'invalid' then raise exception 'Null comment accepted'; end if;
  if public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{comment}',to_jsonb(repeat('ก',1001)))) <> 'invalid' then raise exception 'Oversized comment accepted'; end if;
  if exists(select 1 from public.feedback where player_id=player) then raise exception 'Invalid comment consumed submission'; end if;
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Comment failed'; end if;
  perform public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{comment}','"overwrite"'));
  if (select data from public.feedback where player_id=player) <> '{"player_name":"QA Comment","stars":4,"comment":"เพิ่มอาหาร 🍎"}'::jsonb then raise exception 'Comment trim or immutable retry failed'; end if;
  -- Reuse the same score fixture after removing its feedback inside this rollback-only transaction.
  delete from public.feedback where player_id=player;
  if public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{comment}',to_jsonb(E' \n\t '::text))) <> 'ok' then raise exception 'Empty optional comment failed'; end if;
  if (select data from public.feedback where player_id=player) ? 'comment' then raise exception 'Empty comment was stored'; end if;
  delete from public.feedback where player_id=player;
  perform public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{comment}',to_jsonb(repeat('ก',1000))));
  if length((select data->>'comment' from public.feedback where player_id=player)) <> 1000 then raise exception 'Boundary comment failed'; end if;
  if (select count(*) from pg_catalog.pg_tables where schemaname='public') <> 2 then raise exception 'Extra application tables'; end if;
  if has_function_privilege('anon','public.score_feedback_ingest(uuid,text,jsonb)','EXECUTE') then raise exception 'Public RPC access'; end if;
end $$;
rollback;
