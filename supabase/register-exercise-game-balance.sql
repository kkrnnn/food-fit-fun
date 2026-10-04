-- Only after applying 20261004000400_exercise_game_balance.sql.
insert into supabase_migrations.schema_migrations(version,name)
values('20261004000400','exercise_game_balance') on conflict(version) do nothing;
