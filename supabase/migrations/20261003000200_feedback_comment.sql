-- Optional comments in the existing JSONB; preserves star-only rows and once-only retries.
begin;
alter table public.feedback drop constraint feedback_data_check;
alter table public.feedback add constraint feedback_data_check check (
  jsonb_typeof(data)='object' and data ? 'player_name' and data ? 'stars'
  and jsonb_typeof(data->'stars')='number' and (data->>'stars')::numeric between 1 and 5
  and (data->>'stars')::numeric=trunc((data->>'stars')::numeric)
  and jsonb_typeof(data->'player_name') in ('string','null')
  and (not data ? 'comment' or (jsonb_typeof(data->'comment')='string' and length(data->>'comment') between 1 and 1000))
  and data - 'player_name' - 'stars' - 'comment' = '{}'::jsonb
);
create or replace function public.score_feedback_ingest(p_player_id uuid,p_token_hash text,p_payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
  r jsonb; run_key uuid; owner_id uuid; owner_token text; run_outcome text;
  player_name_value text; inserted_run uuid; comment_value text; feedback_data jsonb;
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
    insert into public.score(id,player_id,player_name,sex,age_years,bmi_start,bmi_end,test_score,game_score,demo,content_version,outcome,started_at,ended_at,token_hash)
    values(run_key,p_player_id,r->>'playerName',r->>'sex',coalesce(r->>'ageYears',r->>'ageYearsAtStart')::integer,
      (r->>'bmiStart')::numeric,(r->>'bmiEnd')::numeric,coalesce(r->>'testScore',r->>'correctCount')::integer,
      coalesce(r->>'gameScore',r->>'score')::integer,(r->>'demo')::boolean,r->>'contentVersion',r->>'outcome',
      (r->>'startedAt')::timestamptz,(r->>'endedAt')::timestamptz,p_token_hash)
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
  -- The ask-after-3 rule belongs to the local survey, which survives a cloud reset.
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
end $$;
revoke all on function public.score_feedback_ingest(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.score_feedback_ingest(uuid,text,jsonb) to service_role;

commit;
