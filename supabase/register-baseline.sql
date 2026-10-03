-- SQL Editor fallback for a baseline already applied manually.
-- With authenticated CLI use: supabase migration repair --status applied 20261003000100
-- Do not run this before the schema exists. Normal db push registers versions automatically.
begin;
do $$ begin
  if to_regclass('public.score') is null or to_regclass('public.feedback') is null then
    raise exception 'Apply create_score_feedback baseline first';
  end if;
end $$;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
alter table supabase_migrations.schema_migrations add column if not exists statements text[];
alter table supabase_migrations.schema_migrations add column if not exists name text;
revoke all on schema supabase_migrations from public,anon,authenticated;
revoke all on supabase_migrations.schema_migrations from public,anon,authenticated;
insert into supabase_migrations.schema_migrations(version,name)
values('20261003000100','create_score_feedback') on conflict(version) do nothing;
commit;
select version,name from supabase_migrations.schema_migrations order by version;
