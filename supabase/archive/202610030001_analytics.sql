begin;
create table public.analytics_players (
  player_id uuid primary key, token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create table public.analytics_runs (
  run_id uuid primary key, player_id uuid not null references public.analytics_players on delete cascade,
  outcome text not null check (outcome in ('completed','game_over','abandoned')),
  score integer not null check (score between 0 and 1000000), demo boolean not null,
  started_at timestamptz not null, ended_at timestamptz not null,
  data jsonb not null, received_at timestamptz not null default now(), check (ended_at >= started_at)
);
create index analytics_runs_player on public.analytics_runs(player_id);
create index analytics_runs_ended on public.analytics_runs(ended_at);
create table public.analytics_answers (
  run_id uuid not null references public.analytics_runs on delete cascade,
  answer_index integer not null check (answer_index between 0 and 9), data jsonb not null,
  primary key (run_id, answer_index)
);
create table public.player_feedback (
  player_id uuid primary key references public.analytics_players on delete cascade,
  context_run_id uuid not null references public.analytics_runs on delete cascade,
  survey_version text not null, rating integer not null check (rating between 1 and 5),
  eligible_run_count integer not null check (eligible_run_count >= 3),
  submitted_at timestamptz not null, received_at timestamptz not null default now()
);
create table public.feedback_events (
  event_id uuid primary key, player_id uuid not null references public.analytics_players on delete cascade,
  context_run_id uuid not null references public.analytics_runs on delete cascade,
  survey_version text not null, event text not null check (event in ('shown','skipped')),
  occurred_at timestamptz not null, received_at timestamptz not null default now()
);
create table public.analytics_rate_limits (
  bucket text primary key, window_start timestamptz not null, requests integer not null
);
alter table public.analytics_players enable row level security;
alter table public.analytics_runs enable row level security;
alter table public.analytics_answers enable row level security;
alter table public.player_feedback enable row level security;
alter table public.feedback_events enable row level security;
alter table public.analytics_rate_limits enable row level security;
revoke all on public.analytics_players, public.analytics_runs, public.analytics_answers,
  public.player_feedback, public.feedback_events, public.analytics_rate_limits from anon, authenticated;

-- Called only by the server secret key. It owns the transaction and checks the credential on every write.
create function public.analytics_ingest(p_player_id uuid, p_token_hash text, p_payload jsonb, p_ip_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  bucket_key text; request_count integer; payload_kind text := p_payload->>'kind';
  run_key uuid; owner_id uuid; run_outcome text; answer jsonb; inserted_run uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then return 'forbidden'; end if;
  -- Shared Postgres counters work across serverless instances; daily salted IP hashes contain no raw IP.
  foreach bucket_key in array array['ip:' || p_ip_hash, 'player:' || p_player_id::text] loop
    insert into public.analytics_rate_limits as b values(bucket_key, now(), 1)
    on conflict (bucket) do update set
      requests = case when b.window_start < now() - interval '1 minute' then 1 else b.requests + 1 end,
      window_start = case when b.window_start < now() - interval '1 minute' then now() else b.window_start end
    returning requests into request_count;
    if request_count > (case when bucket_key like 'ip:%' then 180 else 60 end) then return 'rate_limited'; end if;
  end loop;
  insert into public.analytics_players(player_id, token_hash) values(p_player_id, p_token_hash) on conflict do nothing;
  if not exists(select 1 from public.analytics_players where player_id=p_player_id and token_hash=p_token_hash) then return 'forbidden'; end if;
  if payload_kind = 'run' then
    run_key := (p_payload->'run'->>'runId')::uuid;
    select player_id into owner_id from public.analytics_runs where run_id=run_key;
    if owner_id is not null then return case when owner_id=p_player_id then 'ok' else 'forbidden' end; end if;
    insert into public.analytics_runs(run_id, player_id, outcome, score, demo, started_at, ended_at, data)
    values(run_key, p_player_id, p_payload->'run'->>'outcome', (p_payload->'run'->>'score')::integer,
      (p_payload->'run'->>'demo')::boolean, (p_payload->'run'->>'startedAt')::timestamptz,
      (p_payload->'run'->>'endedAt')::timestamptz, (p_payload->'run') - 'answers')
    on conflict do nothing returning run_id into inserted_run;
    if inserted_run is null then
      select player_id into owner_id from public.analytics_runs where run_id=run_key;
      return case when owner_id=p_player_id then 'ok' else 'forbidden' end;
    end if;
    for answer in select value from jsonb_array_elements(p_payload->'run'->'answers') loop
      insert into public.analytics_answers values(run_key, (answer->>'index')::integer, answer);
    end loop;
    return 'ok';
  end if;
  run_key := (p_payload->>'contextRunId')::uuid;
  select player_id, outcome into owner_id, run_outcome from public.analytics_runs where run_id=run_key;
  if owner_id is null then return 'missing_run'; end if;
  if owner_id <> p_player_id then return 'forbidden'; end if;
  if run_outcome not in ('completed','game_over') or
    (select count(*) from public.analytics_runs where player_id=p_player_id and outcome in ('completed','game_over')) < 3 then return 'ineligible'; end if;
  if payload_kind = 'feedback' then
    insert into public.player_feedback(player_id, context_run_id, survey_version, rating, eligible_run_count, submitted_at)
    values(p_player_id, run_key, p_payload->>'surveyVersion', (p_payload->>'rating')::integer,
      (p_payload->>'eligibleRunCount')::integer, (p_payload->>'occurredAt')::timestamptz) on conflict do nothing;
  elsif payload_kind = 'event' then
    insert into public.feedback_events(event_id, player_id, context_run_id, survey_version, event, occurred_at)
    values((p_payload->>'eventId')::uuid, p_player_id, run_key, p_payload->>'surveyVersion', p_payload->>'event',
      (p_payload->>'occurredAt')::timestamptz) on conflict do nothing;
    if not exists(select 1 from public.feedback_events where event_id=(p_payload->>'eventId')::uuid and player_id=p_player_id) then return 'forbidden'; end if;
  else return 'ineligible'; end if;
  return 'ok';
end $$;
revoke all on function public.analytics_ingest(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.analytics_ingest(uuid,text,jsonb,text) to service_role;

-- Private dashboard/export views. Deliberately no public analytics read endpoint or browser grants.
create view public.analytics_run_report with (security_invoker=true) as
select run_id, player_id, outcome, score, demo, started_at, ended_at, received_at,
  (data->>'ageYearsAtStart')::integer as age_years,
  data->>'contentVersion' as content_version, data->>'blueprintVersion' as blueprint_version,
  data->>'scoringVersion' as scoring_version, data->>'levelVersion' as level_version,
  data->>'inputModeGroup' as input_mode, (data->>'activePlayMs')::numeric as active_play_ms,
  (data->>'correctCount')::integer as correct_count, (data->>'incorrectCount')::integer as incorrect_count,
  (data->>'unreachedCount')::integer as unreached_count, (data->>'trackingPauseCount')::integer as tracking_pause_count
from public.analytics_runs;
create view public.analytics_feedback_report with (security_invoker=true) as
select f.*, r.score as context_score, r.outcome as context_outcome, r.demo,
  r.data->>'contentVersion' as content_version, r.data->>'scoringVersion' as scoring_version,
  r.data->>'inputModeGroup' as input_mode
from public.player_feedback f join public.analytics_runs r on r.run_id=f.context_run_id;
revoke all on public.analytics_run_report, public.analytics_feedback_report from anon, authenticated;
grant select on public.analytics_run_report, public.analytics_feedback_report to service_role;
grant select on public.analytics_runs, public.analytics_answers, public.player_feedback, public.feedback_events to service_role;
commit;
