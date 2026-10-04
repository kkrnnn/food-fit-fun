-- Only after applying 20261004000300_exercise_energy.sql through SQL Editor.
insert into supabase_migrations.schema_migrations(version,name)
values('20261004000300','exercise_energy') on conflict(version) do nothing;
