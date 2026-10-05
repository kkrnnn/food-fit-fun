-- Rollback-only regression; run after migration 20261004000500.
begin;
do $$
declare
  player uuid := '90909090-9090-4090-8090-909090909090';
  run_key uuid := '90909090-9090-4090-8090-909090909091';
  payload jsonb;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='score'
      and column_name in ('bmi_start','bmi_end','test_score','game_score','demo','started_at')
  ) then raise exception 'Retired score columns remain'; end if;
  if (select count(*) from pg_catalog.pg_tables where schemaname='public' and tablename in ('score','feedback')) <> 2 then
    raise exception 'Expected score and feedback tables to remain';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='score' and column_name='net_energy_kcal') then
    raise exception 'Kcal columns missing';
  end if;

  payload := jsonb_build_object('kind','run','run',jsonb_build_object(
    'runId',run_key,'outcome','game_over','playerName','QA Kcal','sex','female','ageYears',20,
    'bmiStart',null,'bmiEnd',null,'testScore',2,'gameScore',260,'demo',true,'contentVersion','qa-kcal-only-v1',
    'startedAt','2026-10-04T00:00:00Z','endedAt','2026-10-04T00:01:00Z',
    'runSchemaVersion',2,'dailyEnergyKcal',1700.09,'foodIntakeKcal',110,'energyStatus','available','energyReason','',
    'energyModelVersion','dri2023-inactive-3plus-v1','activityAssumption','inactive',
    'nutritionVersion','food-portions-2026-10-04-v1','scoringVersion','learning-distance-1500-v3',
    'collectedFoods',jsonb_build_array(jsonb_build_object('foodId','BANANA','name','กล้วย','portionLabel','1 ผลกลาง · ส่วนกินได้ 126 g','kcalPerPortion',110,'count',1))));
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Kcal run insert failed'; end if;
  if not exists (select 1 from public.score where id=run_key and daily_energy_kcal=1700.09 and food_intake_kcal=110 and net_energy_kcal=110) then
    raise exception 'Kcal snapshot missing';
  end if;
  if public.score_feedback_ingest(player,repeat('a',64),jsonb_build_object('kind','feedback','contextRunId',run_key,'rating',5,'comment','โอเค','occurredAt','2026-10-04T00:02:00Z')) <> 'ok' then
    raise exception 'Feedback insert failed';
  end if;
  if not exists (select 1 from public.feedback where score_id=run_key and data->>'stars'='5' and data->>'comment'='โอเค') then
    raise exception 'Feedback row was not preserved';
  end if;

  -- Old queued payloads remain accepted; BMI/game-score inputs are discarded rather than stored.
  payload := jsonb_build_object('kind','run','run',jsonb_build_object(
    'runId','90909090-9090-4090-8090-909090909092','outcome','completed','playerName','QA legacy',
    'ageYearsAtStart',20,'correctCount',1,'score',10,'demo',true,'contentVersion','legacy',
    'bmiStart',22,'bmiEnd',21,'startedAt','2026-10-04T00:00:00Z','endedAt','2026-10-04T00:01:00Z'));
  if public.score_feedback_ingest(player,repeat('a',64),payload) <> 'ok' then raise exception 'Legacy queued run failed'; end if;
  if not exists (select 1 from public.score where id='90909090-9090-4090-8090-909090909092' and run_schema_version is null) then
    raise exception 'Legacy run was backfilled with kcal';
  end if;
end $$;
rollback;
