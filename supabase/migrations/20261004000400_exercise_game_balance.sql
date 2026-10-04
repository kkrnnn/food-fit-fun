-- Each new pickup represents 15 simulated minutes; preserve all historical snapshots.
begin;
alter table public.score drop constraint score_exercise_kcal_check;
alter table public.score add constraint score_exercise_kcal_check check(exercise_kcal>=0 and exercise_kcal<=15000);
alter table public.score drop constraint score_exercise_snapshot;
alter table public.score add constraint score_exercise_snapshot check (
    (exercise_model_version is null and exercise_kcal is null and collected_exercises is null and exercise_energy_status is null and exercise_energy_reason is null)
    or (exercise_model_version is not null and run_schema_version is not distinct from 2
      and exercise_kcal is not null and collected_exercises is not null and (
        (exercise_model_version='exercise-game-30kcal-v1' and exercise_energy_status is null and exercise_energy_reason is null)
        or (exercise_model_version in ('nccor-youth+adult-met-gross-1min-v1','nccor-youth+adult-met-gross-15min-v2') and exercise_energy_status is not null
          and exercise_energy_reason is not null and length(exercise_energy_reason)<=1000
          and (exercise_energy_status='available' or length(exercise_energy_reason)>0))
      ))
  );

create or replace function public.score_feedback_ingest(p_player_id uuid,p_token_hash text,p_payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
  r jsonb; run_key uuid; owner_id uuid; owner_token text; run_outcome text;
  player_name_value text; inserted_run uuid; comment_value text; feedback_data jsonb; food_total numeric; food_count integer; exercise_total numeric; exercise_count integer; e jsonb; activity_id text; met numeric; code_value text; label_value text; source_value text; low_rate numeric; high_rate numeric; common_base numeric; available boolean; legacy_exercise boolean; duration_value numeric;
begin
  if p_player_id is null or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then return 'forbidden'; end if;
  -- Serializes the first submission for a player and once-only ratings across function instances.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_player_id::text,0));
  select token_hash into owner_token from public.score where player_id=p_player_id limit 1;
  if owner_token is not null and owner_token <> p_token_hash then return 'forbidden'; end if;
  if p_payload->>'kind'='run' then
    r := p_payload->'run'; run_key := (r->>'runId')::uuid;
    select player_id,token_hash into owner_id,owner_token from public.score where id=run_key;
    if owner_id is not null then
      return case when owner_id=p_player_id and owner_token=p_token_hash then 'ok' else 'forbidden' end;
    end if;
    -- Limit new score submissions; retries do not consume another slot. No third counter table.
    if (select count(*) from public.score where player_id=p_player_id and created_at > now()-interval '1 minute') >= 60 then return 'rate_limited'; end if;
    if r ? 'runSchemaVersion' then
      if r->>'runSchemaVersion' <> '2' or r->>'nutritionVersion' <> 'food-portions-2026-10-04-v1'
        or r->>'energyModelVersion' <> 'dri2023-inactive-3plus-v1'
        or r->>'scoringVersion' <> 'learning-distance-1500-v3'
        or r->>'activityAssumption' <> 'inactive'
        or r->>'bmiStart' is not null or r->>'bmiEnd' is not null
        or jsonb_typeof(r->'collectedFoods') is distinct from 'array' then return 'invalid'; end if;
      if exists (
        select 1 from jsonb_array_elements(r->'collectedFoods') f
        left join (values ('APPLE',130),('ORANGE',80),('BANANA',110),('BROCCOLI',45),('CARROT',30),
          ('MEAL',394),('WATER',0),('MILK',100),('BURGER',250),('PIZZA',370),('COLA',140),('DONUT',183)) n(id,kcal)
        on f->>'foodId'=n.id
        where n.id is null or jsonb_typeof(f->'count') is distinct from 'number'
          or (f->>'count')::numeric not between 1 and 100
          or (f->>'count')::numeric <> trunc((f->>'count')::numeric)
          or jsonb_typeof(f->'kcalPerPortion') is distinct from 'number'
          or (f->>'kcalPerPortion')::numeric <> n.kcal
      ) then return 'invalid'; end if;
      select coalesce(sum((f->>'count')::integer*(f->>'kcalPerPortion')::numeric),0),
        coalesce(sum((f->>'count')::integer),0) into food_total,food_count
      from jsonb_array_elements(r->'collectedFoods') f;
      if food_count > 100 or jsonb_array_length(r->'collectedFoods') > 12
        or jsonb_array_length(r->'collectedFoods') <> (select count(distinct f->>'foodId') from jsonb_array_elements(r->'collectedFoods') f)
        or jsonb_typeof(r->'foodIntakeKcal') is distinct from 'number'
        or (r->>'foodIntakeKcal')::numeric <> food_total then return 'invalid'; end if;
    end if;
    if r ? 'exerciseModelVersion' then
      legacy_exercise := r->>'exerciseModelVersion'='exercise-game-30kcal-v1';
      duration_value := case when r->>'exerciseModelVersion'='nccor-youth+adult-met-gross-15min-v2' then 15 else 1 end;
      available := (r->>'ageYears')::integer between 6 and 59;
      if r->>'runSchemaVersion' is distinct from '2'
        or r->>'exerciseModelVersion' not in ('exercise-game-30kcal-v1','nccor-youth+adult-met-gross-1min-v1','nccor-youth+adult-met-gross-15min-v2')
        or r->>'exerciseModelVersion' is null or jsonb_typeof(r->'collectedExercises') is distinct from 'array'
        then return 'invalid'; end if;
      if not legacy_exercise and (r->>'sex' is null or r->>'sex' not in ('male','female')
        or r->>'exerciseEnergyStatus' is distinct from (case when available then 'available' else 'unavailable' end)
        or jsonb_typeof(r->'exerciseEnergyReason') is distinct from 'string'
        or length(r->>'exerciseEnergyReason')>1000 or (not available and length(r->>'exerciseEnergyReason')=0)) then return 'invalid'; end if;
      exercise_total := 0; exercise_count := 0; common_base := null;
      for e in select value from jsonb_array_elements(r->'collectedExercises') loop
        activity_id := e->>'itemType';
        if activity_id is null or activity_id not in ('SHOES','DUMBBELL','ROPE')
          or jsonb_typeof(e->'count') is distinct from 'number' or (e->>'count')::numeric not between 1 and 10
          or (e->>'count')::numeric <> trunc((e->>'count')::numeric) then return 'invalid'; end if;
        exercise_count := exercise_count+(e->>'count')::integer;
        if legacy_exercise then
          if jsonb_typeof(e->'kcalPerPickup') is distinct from 'number' or (e->>'kcalPerPickup')::numeric <> 30 then return 'invalid'; end if;
          exercise_total := exercise_total+(e->>'count')::integer*30;
        else
          if e->'durationMinutes' is distinct from to_jsonb(duration_value) or e->>'basis' is distinct from 'gross' or e->'estimated' is distinct from 'true'::jsonb then return 'invalid'; end if;
          label_value := case activity_id when 'SHOES' then 'จ็อกกิงตามจังหวะตัวเอง' when 'DUMBBELL' then 'ออกกำลังด้วยดัมเบล' else 'กระโดดเชือก' end;
          source_value := 'https://www.nccor.org/tools-youthcompendium/met-view-all-categories/';
          if not available then
            if jsonb_typeof(e->'kcalPerPickup') is distinct from 'null' or jsonb_typeof(e->'metKind') is distinct from 'null'
              or jsonb_typeof(e->'metValue') is distinct from 'null' or e->>'activityCode' is distinct from ''
              or e->>'activityLabel' is distinct from label_value or e->>'sourceUrl' is distinct from source_value then return 'invalid'; end if;
          else
            if (r->>'ageYears')::integer<19 then
              code_value := case activity_id when 'SHOES' then '60140X' when 'DUMBBELL' then '85100X' else '10260X' end;
              met := case activity_id
                when 'SHOES' then case when (r->>'ageYears')::integer<10 then 6.8 when (r->>'ageYears')::integer<13 then 7.4 when (r->>'ageYears')::integer<16 then 7.9 else 8.4 end
                when 'DUMBBELL' then case when (r->>'ageYears')::integer<13 then 3 else 2.9 end
                else case when (r->>'ageYears')::integer<10 then 6.9 when (r->>'ageYears')::integer<13 then 7.1 when (r->>'ageYears')::integer<16 then 7.2 else 7.4 end end;
              if e->>'metKind' is distinct from 'METy' then return 'invalid'; end if;
              if r->>'sex'='male' then
                low_rate := case when (r->>'ageYears')::integer<10 then (22.706*10+504.3)/1440 else (17.686*10+658.2)/1440 end;
                high_rate := case when (r->>'ageYears')::integer<10 then (22.706*200+504.3)/1440 else (17.686*200+658.2)/1440 end;
              else
                low_rate := case when (r->>'ageYears')::integer<10 then (20.315*10+485.9)/1440 else (13.384*10+692.6)/1440 end;
                high_rate := case when (r->>'ageYears')::integer<10 then (20.315*200+485.9)/1440 else (13.384*200+692.6)/1440 end;
              end if;
            else
              met := case activity_id when 'SHOES' then 7.5 when 'DUMBBELL' then 3.5 else 11.8 end;
              code_value := case activity_id when 'SHOES' then '12020' when 'DUMBBELL' then '02054' else '15551' end;
              source_value := case activity_id when 'SHOES' then 'https://pacompendium.com/running/' when 'DUMBBELL' then 'https://pacompendium.com/conditioning-exercise/' else 'https://pacompendium.com/sports/' end;
              low_rate := 10::numeric/60; high_rate := 200::numeric/60;
              if e->>'metKind' is distinct from 'MET' then return 'invalid'; end if;
            end if;
            if jsonb_typeof(e->'metValue') is distinct from 'number' or (e->>'metValue')::numeric <> met
              or e->>'activityCode' is distinct from code_value or e->>'activityLabel' is distinct from label_value
              or e->>'sourceUrl' is distinct from source_value or jsonb_typeof(e->'kcalPerPickup') is distinct from 'number'
              or (e->>'kcalPerPickup')::numeric<met*low_rate*duration_value-0.000001 or (e->>'kcalPerPickup')::numeric>met*high_rate*duration_value+0.000001 then return 'invalid'; end if;
            if common_base is not null and abs((e->>'kcalPerPickup')::numeric/met-common_base)>0.000001 then return 'invalid'; end if;
            common_base := (e->>'kcalPerPickup')::numeric/met;
            exercise_total := exercise_total+(e->>'count')::integer*(e->>'kcalPerPickup')::numeric;
          end if;
        end if;
      end loop;
      if exercise_count>10 or jsonb_array_length(r->'collectedExercises')>3
        or jsonb_array_length(r->'collectedExercises') <> (select count(distinct x->>'itemType') from jsonb_array_elements(r->'collectedExercises') x)
        or jsonb_typeof(r->'exerciseKcal') is distinct from 'number' or abs((r->>'exerciseKcal')::numeric-exercise_total)>0.000001 then return 'invalid'; end if;
      if not legacy_exercise and not available and exercise_count>0 then
        if jsonb_typeof(r->'netEnergyKcal') is distinct from 'null' then return 'invalid'; end if;
      elsif jsonb_typeof(r->'netEnergyKcal') is distinct from 'number' or abs((r->>'netEnergyKcal')::numeric-(food_total-exercise_total))>0.000001 then return 'invalid'; end if;
    elsif r ? 'exerciseKcal' or r ? 'netEnergyKcal' or r ? 'collectedExercises' or r ? 'exerciseEnergyStatus' or r ? 'exerciseEnergyReason' then return 'invalid';
    end if;
    insert into public.score(id,player_id,player_name,sex,age_years,bmi_start,bmi_end,test_score,game_score,demo,content_version,outcome,started_at,ended_at,token_hash,run_schema_version,daily_energy_kcal,food_intake_kcal,energy_status,energy_reason,energy_model_version,activity_assumption,nutrition_version,scoring_version,collected_foods,exercise_kcal,exercise_model_version,collected_exercises,exercise_energy_status,exercise_energy_reason)
    values(run_key,p_player_id,r->>'playerName',r->>'sex',coalesce(r->>'ageYears',r->>'ageYearsAtStart')::integer,
      (r->>'bmiStart')::numeric,(r->>'bmiEnd')::numeric,coalesce(r->>'testScore',r->>'correctCount')::integer,
      coalesce(r->>'gameScore',r->>'score')::integer,(r->>'demo')::boolean,r->>'contentVersion',r->>'outcome',
      (r->>'startedAt')::timestamptz,(r->>'endedAt')::timestamptz,p_token_hash,
      (r->>'runSchemaVersion')::integer,(r->>'dailyEnergyKcal')::numeric,(r->>'foodIntakeKcal')::numeric,
      r->>'energyStatus',r->>'energyReason',r->>'energyModelVersion',r->>'activityAssumption',r->>'nutritionVersion',r->>'scoringVersion',r->'collectedFoods',(r->>'exerciseKcal')::numeric,r->>'exerciseModelVersion',r->'collectedExercises',r->>'exerciseEnergyStatus',r->>'exerciseEnergyReason')
    on conflict do nothing returning id into inserted_run;
    if inserted_run is null then
      select player_id,token_hash into owner_id,owner_token from public.score where id=run_key;
      return case when owner_id=p_player_id and owner_token=p_token_hash then 'ok' else 'forbidden' end;
    end if;
    return 'ok';
  end if;
  if p_payload->>'kind'<>'feedback' then return 'ineligible'; end if;
  run_key := (p_payload->>'contextRunId')::uuid;
  select player_id,token_hash,outcome,player_name into owner_id,owner_token,run_outcome,player_name_value
  from public.score where id=run_key;
  if owner_id is null then return 'missing_run'; end if;
  if owner_id<>p_player_id or owner_token<>p_token_hash then return 'forbidden'; end if;
  if run_outcome not in ('completed','game_over') then return 'ineligible'; end if;
  if p_payload ? 'comment' then
    if jsonb_typeof(p_payload->'comment') <> 'string' or length(p_payload->>'comment') > 1000 then return 'invalid'; end if;
    comment_value := nullif(btrim(p_payload->>'comment', E' \t\n\r'), '');
  end if;
  feedback_data := jsonb_build_object('player_name',player_name_value,'stars',(p_payload->>'rating')::integer);
  if comment_value is not null then feedback_data := feedback_data || jsonb_build_object('comment',comment_value); end if;
  insert into public.feedback(player_id,score_id,data,created_at)
  values(p_player_id,run_key,feedback_data,
    (p_payload->>'occurredAt')::timestamptz) on conflict do nothing;
  return 'ok';
exception
  when check_violation then
    if p_payload->'run'->>'runSchemaVersion'='2' then return 'invalid'; end if;
    raise;
  when invalid_text_representation or numeric_value_out_of_range then return 'invalid';
end $$;
revoke all on function public.score_feedback_ingest(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.score_feedback_ingest(uuid,text,jsonb) to service_role;
commit;
