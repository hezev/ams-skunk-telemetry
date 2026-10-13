-- Global AMS Records: aggregated public timing only, no private telemetry payload.
-- Available to authenticated pilots. Progression compares earliest valid lap with personal best.
-- Career sorts by circuit-car records, then unique circuits and recorded laps.
create or replace function public.ams_public_record_board()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
with all_times as (
 select l.pilot_id, l.simulator, l.circuit, l.car, l.lap_time_ms, l.completed_at
 from public.ams_laps l
 where l.lap_time_ms > 0 and nullif(trim(l.circuit),'') is not null and nullif(trim(l.car),'') is not null
 union all
 select b.pilot_id, b.simulator, b.circuit, b.car, b.lap_time_ms, b.completed_at
 from public.ams_best_laps b
 where b.lap_time_ms > 0 and nullif(trim(b.circuit),'') is not null and nullif(trim(b.car),'') is not null
), ranked as (
 select t.*, row_number() over(partition by simulator,circuit,car order by lap_time_ms asc,completed_at asc nulls last,pilot_id) as rank_in_combo
 from all_times t
), winners as (
 select r.simulator,r.circuit,r.car,r.pilot_id,r.lap_time_ms,r.completed_at,
 coalesce(nullif(p.pilot_name,''),'Piloto AMS') as pilot_name
 from ranked r left join public.ams_pilots p on p.id=r.pilot_id
 where r.rank_in_combo=1
), laps_ordered as (
 select l.*,row_number() over(partition by l.pilot_id,l.simulator,l.circuit,l.car order by l.completed_at asc nulls last,l.id) as chronology
 from public.ams_laps l where l.lap_time_ms>0
), pairs as (
 select pilot_id,simulator,circuit,car,
 min(lap_time_ms) as best_ms,
 max(lap_time_ms) filter(where chronology=1) as first_ms,
 count(*) as lap_count
 from laps_ordered group by pilot_id,simulator,circuit,car
), progress as (
 select pilot_id,
 count(*) filter(where lap_count>=2 and first_ms>best_ms) as improved_combos,
 round((sum(greatest(0,first_ms-best_ms)) filter(where lap_count>=2))::numeric/1000,3) as seconds_gained,
 round(100*sum(greatest(0,first_ms-best_ms)) filter(where lap_count>=2)::numeric
 /nullif(sum(first_ms) filter(where lap_count>=2),0),2) as improvement_pct,
 count(*) filter(where lap_count>=2) as comparable_combos
 from pairs group by pilot_id
), career as (
 select l.pilot_id,count(*) as total_laps,count(distinct l.circuit) as tracks,count(distinct(l.simulator,l.circuit,l.car)) as combinations
 from public.ams_laps l where l.lap_time_ms>0 group by l.pilot_id
), win_counts as (
 select pilot_id,count(*) as records from winners group by pilot_id
), pilots as (
 select c.pilot_id,coalesce(nullif(p.pilot_name,''),'Piloto AMS') as pilot_name,
 c.total_laps,c.tracks,c.combinations,coalesce(w.records,0) as records,
 coalesce(g.improved_combos,0) as improved_combos,coalesce(g.comparable_combos,0) as comparable_combos,
 coalesce(g.seconds_gained,0) as seconds_gained,coalesce(g.improvement_pct,0) as improvement_pct
 from career c left join public.ams_pilots p on p.id=c.pilot_id
 left join win_counts w on w.pilot_id=c.pilot_id
 left join progress g on g.pilot_id=c.pilot_id
)
select jsonb_build_object(
 'records',coalesce((select jsonb_agg(to_jsonb(w) order by w.circuit,w.car,w.simulator) from winners w),'[]'::jsonb),
 'progression',coalesce((select jsonb_agg(to_jsonb(p) order by p.improvement_pct desc,p.seconds_gained desc,p.improved_combos desc,p.pilot_name)
  from pilots p where p.comparable_combos>0),'[]'::jsonb),
 'career',coalesce((select jsonb_agg(to_jsonb(p) order by p.records desc,p.tracks desc,p.total_laps desc,p.pilot_name)
  from pilots p),'[]'::jsonb)
);
$$;
revoke all on function public.ams_public_record_board() from public,anon;
grant execute on function public.ams_public_record_board() to authenticated;
