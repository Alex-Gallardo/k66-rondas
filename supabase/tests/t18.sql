-- T-18: progreso por ronda, puntos opcionales y privilegios de la vista.
do $$
declare
  v_guard uuid;
  v_template uuid := gen_random_uuid();
  v_shift uuid;
  v_completed uuid;
  v_open uuid;
  v_result text;
  v_gate uuid := '20000000-0000-4000-8000-000000000001';
begin
  if has_table_privilege('anon', 'public.patrol_progress', 'SELECT')
    or has_table_privilege('authenticated', 'public.patrol_progress', 'SELECT')
    or not has_table_privilege('service_role', 'public.patrol_progress', 'SELECT') then
    raise exception 'Permisos de patrol_progress incorrectos';
  end if;
  if (select count(*) from public.patrol_progress) <> (select count(*) from public.patrols) then
    raise exception 'La vista no devuelve una fila por ronda';
  end if;
  if not exists (
    select 1 from public.patrols p
    join public.profiles u on u.id = p.guard_id
    join public.patrol_progress pr on pr.patrol_id = p.id
    where u.employee_code = 'E2E-T11-SQL' and p.status = 'incomplete'
      and p.closure_reason = 'Acceso restringido'
      and pr.expected_total = 2 and pr.visited_total = 0
      and pr.required_total = 2 and pr.required_visited = 0
  ) then raise exception 'El cierre incompleto no muestra puntos faltantes'; end if;

  select id into v_guard from public.profiles where employee_code = 'E2E-T18-SQL';
  if v_guard is null then raise exception 'Falta guardia T-18'; end if;
  insert into public.patrol_templates (id, gate_id, name)
    values (v_template, v_gate, 'Ronda con punto opcional');
  insert into public.template_points (template_id, checkpoint_id, position, required) values
    (v_template, '40000000-0000-4000-8000-000000000001', 1, true),
    (v_template, '40000000-0000-4000-8000-000000000002', 2, false);
  v_shift := public.open_guard_shift(v_guard, v_gate);
  v_completed := public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
  perform public.record_visit(v_guard, '11111111111111111111111111111111', gen_random_uuid(),
    '{"status":"unavailable"}');
  v_result := public.close_guard_patrol(v_guard, v_completed, null);
  if v_result <> 'completed' or not exists (
    select 1 from public.patrol_progress where patrol_id = v_completed
      and expected_total = 2 and visited_total = 1
      and required_total = 1 and required_visited = 1
  ) then raise exception 'El punto opcional pendiente se contó como obligatorio'; end if;

  v_open := public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
  if not exists (
    select 1 from public.patrols p join public.patrol_progress pr on pr.patrol_id = p.id
    where p.id = v_open and p.status = 'in_progress' and p.ended_at is null
      and pr.expected_total = 2 and pr.visited_total = 0
  ) then raise exception 'La ronda en curso no muestra su avance'; end if;
end $$;
