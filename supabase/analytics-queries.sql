-- Private Supabase Dashboard/export queries after migration 20261004000500. Never export token_hash.
select id,player_id,player_name,sex,age_years,run_schema_version,daily_energy_kcal,food_intake_kcal,exercise_kcal,net_energy_kcal,exercise_model_version,exercise_energy_status,exercise_energy_reason,collected_exercises,energy_status,energy_reason,energy_model_version,activity_assumption,nutrition_version,scoring_version,collected_foods,content_version,outcome,ended_at
from public.score order by ended_at desc;

select player_id,score_id,data->>'player_name' as player_name,(data->>'stars')::integer as stars,data->>'comment' as comment,created_at
from public.feedback order by created_at desc;

select (f.data->>'stars')::integer as stars,count(*) as responses,count(distinct f.player_id) as players
from public.feedback f join public.score s on s.id=f.score_id
where s.content_version not like 'qa-%'
group by stars order by stars;
