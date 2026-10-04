-- Only after applying 20261004000200_kcal_energy.sql via SQL Editor.
insert into supabase_migrations.schema_migrations(version,name)
values('20261004000200','kcal_energy') on conflict(version) do nothing;
select version,name from supabase_migrations.schema_migrations order by version;
