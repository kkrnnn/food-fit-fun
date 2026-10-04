-- Private Supabase Dashboard/export queries after migration 20261004000100. Never export token_hash.
select id,player_id,player_name,sex,age_years,bmi_start,bmi_end,test_score,game_score,demo,outcome,ended_at
from public.score order by ended_at desc;

select player_id,score_id,data->>'player_name' as player_name,(data->>'stars')::integer as stars,data->>'comment' as comment,created_at
from public.feedback order by created_at desc;

-- Filter dates/demo/content before interpreting results. QA fixtures are excluded.
select demo,count(*) as runs,count(distinct player_id) as players,
  round(avg(test_score),2) as average_test_score_out_of_10,round(avg(game_score),2) as average_game_score
from public.score where content_version not like 'qa-feedback-%' group by demo;

select (f.data->>'stars')::integer as stars,count(*) as responses,count(distinct f.player_id) as players
from public.feedback f join public.score s on s.id=f.score_id
where s.content_version not like 'qa-feedback-%'
group by stars order by stars;
