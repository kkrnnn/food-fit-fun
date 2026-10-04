-- Rollback-only migration regression, safe with existing participant rows.
begin;
do $$
declare
  player uuid := '99999999-9999-4999-8999-999999999999';
  run_key uuid := 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  p jsonb; invalid_p jsonb; score_before bigint; feedback_before bigint;
begin
  select count(*) into score_before from public.score;
  select count(*) into feedback_before from public.feedback;
  p := jsonb_build_object('kind','run','run',jsonb_build_object(
    'runId',run_key,'outcome','game_over','playerName','QA kcal','sex','male','ageYears',10,
    'bmiStart',null,'bmiEnd',null,'testScore',2,'gameScore',260,'demo',true,'contentVersion','qa-kcal-v1',
    'startedAt','2026-10-04T00:00:00Z','endedAt','2026-10-04T00:01:00Z',
    'runSchemaVersion',2,'dailyEnergyKcal',1700.09,'foodIntakeKcal',220,'energyStatus','available','energyReason','',
    'energyModelVersion','dri2023-inactive-3plus-v1','activityAssumption','inactive',
    'nutritionVersion','food-portions-2026-10-04-v1','scoringVersion','learning-distance-1500-v3',
    'collectedFoods','[{"foodId":"BANANA","name":"กล้วย","portionLabel":"1 ผลกลาง · ส่วนกินได้ 126 g","kcalPerPortion":110,"count":2}]'::jsonb));
  if public.score_feedback_ingest(player,repeat('c',64),p) <> 'ok' then raise exception 'kcal insert failed'; end if;
  if not exists(select 1 from public.score where id=run_key and bmi_start is null and bmi_end is null
    and daily_energy_kcal=1700.09 and food_intake_kcal=220 and run_schema_version=2 and collected_foods->0->>'count'='2') then raise exception 'kcal snapshot missing'; end if;
  perform public.score_feedback_ingest(player,repeat('c',64),jsonb_set(p,'{run,foodIntakeKcal}','999'));
  if (select food_intake_kcal from public.score where id=run_key) <> 220 then raise exception 'retry overwrote snapshot'; end if;
  if public.score_feedback_ingest(player,repeat('d',64),p) <> 'forbidden' then raise exception 'ownership lost'; end if;
  p := jsonb_set(p,'{run,runId}','"aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
  foreach invalid_p in array array[
    jsonb_set(p,'{run,foodIntakeKcal}','221'),
    jsonb_set(p,'{run,dailyEnergyKcal}','0'),
    jsonb_set(p,'{run,bmiStart}','18'),
    jsonb_set(p,'{run,collectedFoods,0,kcalPerPortion}','-110'),
    jsonb_set(p,'{run,collectedFoods,0,count}','1.5'),
    jsonb_set(p,'{run,collectedFoods,0,foodId}','"SHOES"')
  ] loop
    if public.score_feedback_ingest(player,repeat('c',64),invalid_p) <> 'invalid' then raise exception 'invalid kcal accepted: %',invalid_p; end if;
  end loop;
  p := jsonb_set(jsonb_set(jsonb_set(p,'{run,dailyEnergyKcal}','null'),'{run,energyStatus}','"unavailable"'),'{run,energyReason}','"unsupported age"');
  if public.score_feedback_ingest(player,repeat('c',64),p) <> 'ok' then raise exception 'unavailable EER failed'; end if;
  if (select count(*) from public.score) <> score_before+2 then raise exception 'invalid rows persisted'; end if;
  if (select count(*) from public.feedback) <> feedback_before then raise exception 'feedback changed'; end if;
  if has_table_privilege('anon','public.score','SELECT') or has_function_privilege('anon','public.score_feedback_ingest(uuid,text,jsonb)','EXECUTE') then raise exception 'public access'; end if;
end $$;
rollback;
