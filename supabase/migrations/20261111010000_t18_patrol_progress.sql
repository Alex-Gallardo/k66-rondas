-- Una fila por ronda: evita contar los puntos por separado en cada tarjeta.
create view public.patrol_progress as
select
  p.id as patrol_id,
  count(ep.id)::integer as expected_total,
  count(v.id)::integer as visited_total,
  count(ep.id) filter (where ep.required)::integer as required_total,
  count(v.id) filter (where ep.required)::integer as required_visited
from public.patrols p
left join public.patrol_expected_points ep on ep.patrol_id = p.id
left join public.visits v on v.patrol_id = p.id and v.checkpoint_id = ep.checkpoint_id
group by p.id;

revoke all on public.patrol_progress from public, anon, authenticated;
grant select on public.patrol_progress to service_role;
