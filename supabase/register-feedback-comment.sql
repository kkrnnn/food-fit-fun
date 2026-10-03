-- Only after applying 20261003000200_feedback_comment.sql via SQL Editor.
insert into supabase_migrations.schema_migrations(version,name)
values('20261003000200','feedback_comment') on conflict(version) do nothing;
select version,name from supabase_migrations.schema_migrations order by version;
