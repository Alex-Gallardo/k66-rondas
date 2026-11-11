-- Agregados operativos en servidor. La función solo es ejecutable con service_role.
create function public.dashboard_metrics(
  p_site_id uuid,
  p_gate_ids uuid[],
  p_from_utc timestamptz,
  p_to_utc timestamptz,
  p_from_date date,
  p_to_date date
) returns jsonb language sql stable set search_path = '' as $$
with
  site as (
    select timezone from public.sites where id = p_site_id
  ),
  allowed_gates as (
    select id from public.gates
    where site_id = p_site_id and id = any(p_gate_ids)
  ),
  filtered_visits as (
    select v.recorded_at, v.geo_status
    from public.visits v join allowed_gates g on g.id = v.gate_id
    where v.recorded_at >= p_from_utc and v.recorded_at < p_to_utc
  ),
  filtered_rounds as (
    select p.id, p.status, p.started_at, p.ended_at,
      pr.required_total, pr.required_visited
    from public.patrols p join allowed_gates g on g.id = p.gate_id
    join public.patrol_progress pr on pr.patrol_id = p.id
    where p.started_at >= p_from_utc and p.started_at < p_to_utc
  ),
  visit_summary as (
    select count(*)::integer as visits,
      count(*) filter (where geo_status = 'captured')::integer as geo_captured
    from filtered_visits
  ),
  round_summary as (
    select count(*)::integer as started,
      count(*) filter (where status = 'completed')::integer as completed,
      count(*) filter (where status = 'incomplete')::integer as incomplete,
      count(*) filter (where status = 'in_progress')::integer as in_progress,
      coalesce(sum(required_total), 0)::integer as required_expected,
      coalesce(sum(required_visited), 0)::integer as required_visited
    from filtered_rounds
  ),
  durations as (
    select
      round((percentile_cont(0.5) within group (
        order by extract(epoch from (ended_at - started_at)) / 60
      ))::numeric, 1) as median_minutes,
      round((percentile_cont(0.9) within group (
        order by extract(epoch from (ended_at - started_at)) / 60
      ))::numeric, 1) as p90_minutes
    from filtered_rounds
    where status = 'completed' and ended_at is not null
  ),
  assigned_guards as (
    select distinct ga.profile_id
    from public.gate_assignments ga
    join allowed_gates g on g.id = ga.gate_id
    join public.profiles u on u.id = ga.profile_id
    where ga.active and u.active and u.role = 'guard'
  ),
  adoption as (
    select count(*)::integer as assigned,
      count(*) filter (where exists (
        select 1 from public.shifts sh join allowed_gates g on g.id = sh.gate_id
        where sh.guard_id = ag.profile_id
          and sh.started_at >= p_from_utc and sh.started_at < p_to_utc
      ))::integer as active
    from assigned_guards ag
  ),
  daily_visits as (
    select timezone(s.timezone, v.recorded_at)::date as day,
      count(*)::integer as visits
    from filtered_visits v cross join site s
    group by 1
  ),
  daily_rounds as (
    select timezone(s.timezone, p.started_at)::date as day,
      count(*)::integer as rounds
    from filtered_rounds p cross join site s
    group by 1
  ),
  days as (
    select generate_series(p_from_date::timestamp, p_to_date::timestamp,
      interval '1 day')::date as day
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day, 'visits', coalesce(v.visits, 0),
      'rounds', coalesce(r.rounds, 0)
    ) order by d.day), '[]'::jsonb) as series
    from days d left join daily_visits v on v.day = d.day
    left join daily_rounds r on r.day = d.day
  )
select jsonb_build_object(
  'visits', v.visits,
  'geo_captured', v.geo_captured,
  'rounds_started', r.started,
  'rounds_completed', r.completed,
  'rounds_incomplete', r.incomplete,
  'rounds_in_progress', r.in_progress,
  'required_expected', r.required_expected,
  'required_visited', r.required_visited,
  'duration_median_minutes', d.median_minutes,
  'duration_p90_minutes', d.p90_minutes,
  'assigned_guards', a.assigned,
  'active_guards', a.active,
  'daily', dy.series
)
from visit_summary v cross join round_summary r
cross join durations d cross join adoption a cross join daily dy;
$$;

revoke all on function public.dashboard_metrics(uuid,uuid[],timestamptz,timestamptz,date,date)
  from public, anon, authenticated;
grant execute on function public.dashboard_metrics(uuid,uuid[],timestamptz,timestamptz,date,date)
  to service_role;
