-- Add kcal snapshots without changing historical BMI units or participant rows.
begin;
alter table public.score
  add column run_schema_version integer,
  add column daily_energy_kcal numeric check (daily_energy_kcal > 0 and daily_energy_kcal <= 100000),
  add column food_intake_kcal numeric check (food_intake_kcal >= 0 and food_intake_kcal <= 1000000),
  add column energy_status text check (energy_status in ('available','unavailable')),
  add column energy_reason text,
  add column energy_model_version text,
  add column activity_assumption text check (activity_assumption='inactive'),
  add column nutrition_version text,
  add column scoring_version text,
  add column collected_foods jsonb check (jsonb_typeof(collected_foods)='array'),
  add constraint score_energy_snapshot check (
    run_schema_version is null or (
      run_schema_version=2 and bmi_start is null and bmi_end is null
      and food_intake_kcal is not null and energy_status is not null
      and energy_reason is not null and length(energy_reason) <= 1000
      and energy_model_version is not null and activity_assumption is not null
      and nutrition_version is not null and scoring_version is not null and collected_foods is not null
      and ((energy_status='available' and daily_energy_kcal is not null)
        or (energy_status='unavailable' and daily_energy_kcal is null and length(energy_reason)>0))
    )
  );
comment on column public.score.daily_energy_kcal is 'DRI 2023 daily EER estimate at run start; inactive assumption, not calories consumed';
comment on column public.score.food_intake_kcal is 'Sum of referenced food portions collected in the game, starting at zero';
comment on column public.score.collected_foods is 'Immutable food, portion, energy and count snapshots; not real dietary intake';
create or replace function public.score_feedback_ingest(p_player_id uuid,p_token_hash text,p_payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
  r jsonb; run_key uuid; owner_id uuid; owner_token text; run_outcome text;
  player_name_value text; inserted_run uuid; comment_value text; feedback_data jsonb; food_total numeric; food_count integer;
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
    insert into public.score(id,player_id,player_name,sex,age_years,bmi_start,bmi_end,test_score,game_score,demo,content_version,outcome,started_at,ended_at,token_hash,run_schema_version,daily_energy_kcal,food_intake_kcal,energy_status,energy_reason,energy_model_version,activity_assumption,nutrition_version,scoring_version,collected_foods)
    values(run_key,p_player_id,r->>'playerName',r->>'sex',coalesce(r->>'ageYears',r->>'ageYearsAtStart')::integer,
      (r->>'bmiStart')::numeric,(r->>'bmiEnd')::numeric,coalesce(r->>'testScore',r->>'correctCount')::integer,
      coalesce(r->>'gameScore',r->>'score')::integer,(r->>'demo')::boolean,r->>'contentVersion',r->>'outcome',
      (r->>'startedAt')::timestamptz,(r->>'endedAt')::timestamptz,p_token_hash,
      (r->>'runSchemaVersion')::integer,(r->>'dailyEnergyKcal')::numeric,(r->>'foodIntakeKcal')::numeric,
      r->>'energyStatus',r->>'energyReason',r->>'energyModelVersion',r->>'activityAssumption',r->>'nutritionVersion',r->>'scoringVersion',r->'collectedFoods')
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
