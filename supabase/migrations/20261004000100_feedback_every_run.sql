-- Keep existing feedback rows while allowing one immutable response per finished run.
begin;
alter table public.feedback drop constraint feedback_pkey;
alter table public.feedback add constraint feedback_pkey primary key (score_id);
create index feedback_player_created on public.feedback(player_id, created_at desc);
comment on table public.feedback is 'One response per finished score; a player may respond to multiple runs';
commit;
