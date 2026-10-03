-- Destructive reset authorized by the user: discard the old analytics data and leave two empty tables.
begin;
create table public.score (
  id uuid primary key,
  player_id uuid not null,
  player_name text check (length(player_name) between 1 and 80),
  sex text check (sex in ('male','female')),
  age_years integer check (age_years between 0 and 150),
  bmi_start numeric check (bmi_start > 0 and bmi_start <= 1000),
  bmi_end numeric check (bmi_end > 0 and bmi_end <= 1000),
  test_score integer check (test_score between 0 and 10),
  game_score integer not null check (game_score between 0 and 1000000),
  demo boolean not null,
  content_version text not null,
  outcome text not null check (outcome in ('completed','game_over','abandoned')),
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at >= started_at),
  created_at timestamptz not null default now(),
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$')
);
comment on column public.score.bmi_start is 'BMI calculated from player measurements at run start';
comment on column public.score.bmi_end is 'Simulated character BMI at run end, not a new physical measurement';
comment on column public.score.test_score is 'Correct answers, out of 10; unreached questions earn no points';
comment on column public.score.token_hash is 'Private submission credential hash; exclude from exports';
create index score_player on public.score(player_id,created_at);
create index score_ended on public.score(ended_at);
create table public.feedback (
  player_id uuid primary key,
  score_id uuid not null references public.score(id),
  data jsonb not null check (
    jsonb_typeof(data)='object' and data ? 'player_name' and data ? 'stars'
    and jsonb_typeof(data->'stars')='number' and (data->>'stars')::numeric between 1 and 5
    and (data->>'stars')::numeric=trunc((data->>'stars')::numeric)
    and (jsonb_typeof(data->'player_name') in ('string','null'))
    and data - 'player_name' - 'stars' = '{}'::jsonb
  ),
  created_at timestamptz not null default now()
);
alter table public.score enable row level security;
alter table public.feedback enable row level security;
revoke all on public.score, public.feedback from anon, authenticated;
grant select on public.score, public.feedback to service_role;

-- No legacy rows are copied: the user requested a fresh database.

create function public.score_feedback_ingest(p_player_id uuid,p_token_hash text,p_payload jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
  r jsonb; run_key uuid; owner_id uuid; owner_token text; run_outcome text;
  player_name_value text; inserted_run uuid;
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
  insert into public.feedback(player_id,score_id,data,created_at)
  values(p_player_id,run_key,jsonb_build_object('player_name',player_name_value,'stars',(p_payload->>'rating')::integer),
    (p_payload->>'occurredAt')::timestamptz) on conflict do nothing;
  return 'ok';
end $$;
revoke all on function public.score_feedback_ingest(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.score_feedback_ingest(uuid,text,jsonb) to service_role;

-- Old deployments/queued payloads remain compatible through the cutover. Events are retired.
create or replace function public.analytics_ingest(p_player_id uuid,p_token_hash text,p_payload jsonb,p_ip_hash text)
returns text language plpgsql security definer set search_path='' as $$
begin
  if p_payload->>'kind'='event' then return 'ok'; end if;
  return public.score_feedback_ingest(p_player_id,p_token_hash,p_payload);
end $$;
revoke all on function public.analytics_ingest(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.analytics_ingest(uuid,text,jsonb,text) to service_role;

drop view public.analytics_feedback_report;
drop view public.analytics_run_report;
drop table public.feedback_events;
drop table public.player_feedback;
drop table public.analytics_answers;
drop table public.analytics_runs;
drop table public.analytics_players;
drop table public.analytics_rate_limits;
commit;
