-- Only after applying 20261004000500_score_kcal_only.sql via SQL Editor.
insert into supabase_migrations.schema_migrations(version,name)
values('20261004000500','score_kcal_only') on conflict(version) do nothing;
select version,name from supabase_migrations.schema_migrations order by version;
