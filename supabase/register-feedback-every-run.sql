-- Only after applying 20261004000100_feedback_every_run.sql via SQL Editor.
insert into supabase_migrations.schema_migrations(version,name)
values('20261004000100','feedback_every_run') on conflict(version) do nothing;
select version,name from supabase_migrations.schema_migrations order by version;
