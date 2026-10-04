-- Run after migration 20261004000100; all fixture writes roll back.
begin;
do $$
declare
  player uuid := '77777777-7777-4777-8777-777777777778';
  first_run uuid := '88888888-8888-4888-8888-888888888889';
  second_run uuid := '88888888-8888-4888-8888-888888888890';
  payload jsonb;
begin
  foreach payload in array array[
    jsonb_build_object('kind','run','run',jsonb_build_object('runId',first_run,'outcome','game_over','playerName','QA Player','sex','female','ageYears',20,'bmiStart',22,'bmiEnd',23,'testScore',2,'gameScore',100,'demo',true,'contentVersion','qa-every-run','startedAt','2026-10-04T00:00:00Z','endedAt','2026-10-04T00:01:00Z')),
    jsonb_build_object('kind','run','run',jsonb_build_object('runId',second_run,'outcome','completed','playerName','QA Player','sex','female','ageYears',20,'bmiStart',22,'bmiEnd',21,'testScore',8,'gameScore',250,'demo',true,'contentVersion','qa-every-run','startedAt','2026-10-04T00:02:00Z','endedAt','2026-10-04T00:03:00Z'))
  ] loop
    if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Score failed'; end if;
  end loop;
  payload := jsonb_build_object('kind','feedback','contextRunId',first_run,'rating',2,'comment','ปรับความยาก','occurredAt','2026-10-04T00:04:00Z');
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'First feedback failed'; end if;
  perform public.score_feedback_ingest(player,repeat('a',64),jsonb_set(payload,'{rating}','5'));
  payload := jsonb_build_object('kind','feedback','contextRunId',second_run,'rating',5,'comment','สนุกแล้ว','occurredAt','2026-10-04T00:05:00Z');
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Second feedback failed'; end if;
  if (select count(*) from public.feedback where player_id=player) <> 2 then raise exception 'Expected two feedback rows for one player'; end if;
  if (select data->>'stars' from public.feedback where score_id=first_run) <> '2'
    or (select data->>'comment' from public.feedback where score_id=second_run) <> 'สนุกแล้ว'
    then raise exception 'Feedback overwritten or mapped to wrong run'; end if;
  if (select count(*) from pg_catalog.pg_tables where schemaname='public') <> 2 then raise exception 'Extra application tables'; end if;
end $$;
rollback;
