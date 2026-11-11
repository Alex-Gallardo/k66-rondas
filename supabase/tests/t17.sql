-- T-17: visita de otra garita para comprobar filtros y alcance de supervisor.
do $$
declare
  v_guard uuid;
  v_gate uuid := '20000000-0000-4000-8000-000000000002';
  v_template uuid := gen_random_uuid();
  v_shift uuid;
  v_result jsonb;
begin
  select id into v_guard from public.profiles where employee_code = 'E2E-T17-OTHER';
  if v_guard is null then raise exception 'Falta guardia T-17'; end if;
  insert into public.patrol_templates (id, gate_id, name, is_default)
    values (v_template, v_gate, 'Ronda anexa de prueba', true);
  insert into public.template_points (template_id, checkpoint_id, position, required)
    values (v_template, '40000000-0000-4000-8000-000000000001', 1, true);
  v_shift := public.open_guard_shift(v_guard, v_gate);
  perform public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
  v_result := public.record_visit(v_guard, '11111111111111111111111111111111', gen_random_uuid(),
    '{"status":"captured","latitude":14.6349,"longitude":-90.5069,"accuracy_m":8,"client_ip":"203.0.113.8"}');
  if v_result->>'outcome' <> 'recorded' or not exists (
    select 1 from public.visits where id = (v_result->>'visit_id')::uuid
      and client_ip = '203.0.113.8'::inet and latitude = 14.6349
      and longitude = -90.5069 and accuracy_m = 8
  ) then raise exception 'T-17 no guardó GPS e IP'; end if;
end $$;
