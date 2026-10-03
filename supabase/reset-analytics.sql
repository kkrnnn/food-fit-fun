-- DESTRUCTIVE, explicit one-time reset only. Never put this file in migrations/.
-- Removes only this application's tables/views/functions, never Supabase auth/storage/system schemas.
begin;
drop view if exists public.analytics_feedback_report;
drop view if exists public.analytics_run_report;
drop table if exists public.feedback;
drop table if exists public.score;
drop table if exists public.feedback_events;
drop table if exists public.player_feedback;
drop table if exists public.analytics_answers;
drop table if exists public.analytics_runs;
drop table if exists public.analytics_players;
drop table if exists public.analytics_rate_limits;
drop function if exists public.analytics_ingest(uuid,text,jsonb,text);
drop function if exists public.score_feedback_ingest(uuid,text,jsonb);
-- Only our own baseline marker is removed, if CLI history exists. Other projects' migrations stay untouched.
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version='20261003000100';
  end if;
end $$;
commit;
