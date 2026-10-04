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
    'runId',run_key,'outcome','game_over','playerName','QA kcal','sex','male','ageYears',12,
    'bmiStart',null,'bmiEnd',null,'testScore',2,'gameScore',260,'demo',true,'contentVersion','qa-kcal-v1',
    'startedAt','2026-10-04T00:00:00Z','endedAt','2026-10-04T00:01:00Z',
    'runSchemaVersion',2,'dailyEnergyKcal',1700.09,'foodIntakeKcal',220,'energyStatus','available','energyReason','',
    'energyModelVersion','dri2023-inactive-3plus-v1','activityAssumption','inactive',
    'nutritionVersion','food-portions-2026-10-04-v1','scoringVersion','learning-distance-1500-v3',
    'collectedFoods','[{"foodId":"BANANA","name":"กล้วย","portionLabel":"1 ผลกลาง · ส่วนกินได้ 126 g","kcalPerPortion":110,"count":2}]'::jsonb));
  p := jsonb_set(p,'{run,foodIntakeKcal}','0');
  p := jsonb_set(p,'{run,collectedFoods}','[]');
  p := p->'run' || '{"exerciseModelVersion":"nccor-youth+adult-met-gross-1min-v1","exerciseKcal":6.733364,"netEnergyKcal":-6.733364,"exerciseEnergyStatus":"available","exerciseEnergyReason":"","collectedExercises":[{"itemType":"ROPE","count":1,"kcalPerPickup":6.733364,"durationMinutes":1,"activityLabel":"กระโดดเชือก","activityCode":"10260X","metKind":"METy","metValue":7.1,"sourceUrl":"https://www.nccor.org/tools-youthcompendium/met-view-all-categories/","basis":"gross","estimated":true}]}';
  p := jsonb_build_object('kind','run','run',p);
  if public.score_feedback_ingest(player,repeat('c',64),p) <> 'ok' then raise exception 'exercise insert failed'; end if;
  if not exists(select 1 from public.score where id=run_key and bmi_start is null and bmi_end is null
    and daily_energy_kcal=1700.09 and food_intake_kcal=0 and exercise_kcal=6.733364 and net_energy_kcal=-6.733364 and collected_exercises->0->>'count'='1') then raise exception 'exercise snapshot missing'; end if;
  perform public.score_feedback_ingest(player,repeat('c',64),jsonb_set(p,'{run,foodIntakeKcal}','999'));
  if (select food_intake_kcal from public.score where id=run_key) <> 0 then raise exception 'retry overwrote snapshot'; end if;
  if public.score_feedback_ingest(player,repeat('d',64),p) <> 'forbidden' then raise exception 'ownership lost'; end if;
  p := jsonb_set(p,'{run,runId}','"aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
  foreach invalid_p in array array[
    jsonb_set(p,'{run,exerciseKcal}','31'),
    jsonb_set(p,'{run,netEnergyKcal}','0'),
    jsonb_set(p,'{run,collectedExercises,0,count}','1.5'),
    jsonb_set(p,'{run,collectedExercises,0,count}','11'),
    jsonb_set(p,'{run,collectedExercises,0,itemType}','"APPLE"'),
    jsonb_set(p,'{run,collectedExercises,0,kcalPerPickup}','300'),
    jsonb_set(p,'{run,exerciseModelVersion}','"fake"'),
    jsonb_set(p,'{run,collectedExercises,0,activityCode}','"fake"'),
    jsonb_set(p,'{run,collectedExercises,0,sourceUrl}','"https://fake.test"'),
    jsonb_set(p,'{run,exerciseEnergyStatus}','"unavailable"'),
    p #- '{run,exerciseModelVersion}'
  ] loop
    if public.score_feedback_ingest(player,repeat('c',64),invalid_p) <> 'invalid' then raise exception 'invalid kcal accepted: %',invalid_p; end if;
  end loop;
  p := jsonb_set(jsonb_set(jsonb_set(p,'{run,dailyEnergyKcal}','null'),'{run,energyStatus}','"unavailable"'),'{run,energyReason}','"unsupported age"');
  if public.score_feedback_ingest(player,repeat('c',64),p) <> 'ok' then raise exception 'unavailable EER failed'; end if;
  p := jsonb_set(p,'{run,runId}','"aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
  p := jsonb_set(p,'{run,ageYears}','5');
  p := jsonb_set(p,'{run,exerciseEnergyStatus}','"unavailable"');
  p := jsonb_set(p,'{run,exerciseEnergyReason}','"unsupported age"');
  p := jsonb_set(p,'{run,exerciseKcal}','0');
  p := jsonb_set(p,'{run,netEnergyKcal}','null');
  p := jsonb_set(p,'{run,collectedExercises,0,kcalPerPickup}','null');
  p := jsonb_set(p,'{run,collectedExercises,0,metValue}','null');
  p := jsonb_set(p,'{run,collectedExercises,0,metKind}','null');
  p := jsonb_set(p,'{run,collectedExercises,0,activityCode}','""');
  if public.score_feedback_ingest(player,repeat('c',64),p)<>'ok' then raise exception 'unsupported exercise failed'; end if;
  if not exists(select 1 from public.score where id='aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and net_energy_kcal is null and exercise_energy_status='unavailable') then raise exception 'unsupported became zero'; end if;
  p := jsonb_set(p,'{run,runId}','"aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
  p := jsonb_set(p,'{run,exerciseModelVersion}','"exercise-game-30kcal-v1"');
  p := p #- '{run,exerciseEnergyStatus}' #- '{run,exerciseEnergyReason}';
  p := jsonb_set(p,'{run,exerciseKcal}','30');p := jsonb_set(p,'{run,netEnergyKcal}','-30');
  p := jsonb_set(p,'{run,collectedExercises}','[{"itemType":"ROPE","count":1,"kcalPerPickup":30}]');
  if public.score_feedback_ingest(player,repeat('c',64),p)<>'ok' then raise exception 'legacy exercise failed'; end if;
  if (select count(*) from public.score) <> score_before+4 then raise exception 'invalid rows persisted'; end if;
  if (select count(*) from public.feedback) <> feedback_before then raise exception 'feedback changed'; end if;
  if has_table_privilege('anon','public.score','SELECT') or has_function_privilege('anon','public.score_feedback_ingest(uuid,text,jsonb)','EXECUTE') then raise exception 'public access'; end if;
end $$;
rollback;
