-- T-12: se ejecuta después de los tests de Fase 2 y T-11, solo en Supabase local.
do $$
declare
  v_guard uuid;
  v_admin uuid;
  v_gate uuid := '20000000-0000-4000-8000-000000000001';
  v_template uuid := '50000000-0000-4000-8000-000000000001';
  v_shift uuid;
  v_patrol uuid;
  v_key uuid := gen_random_uuid();
  v_other_key uuid := gen_random_uuid();
  v_result jsonb;
  v_visit_id uuid;
  v_qr_one text := '11111111111111111111111111111111';
  v_qr_two text := '22222222222222222222222222222222';
  v_qr_rotated text := '33333333333333333333333333333333';
begin
  select id into v_guard from public.profiles where employee_code = 'E2E-T12-SQL';
  select id into v_admin from public.profiles where employee_code = 'E2E-ADMIN';
  if v_guard is null or v_admin is null then raise exception 'Faltan usuarios T-12'; end if;
  if has_function_privilege('anon', 'public.record_visit(uuid,text,uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.record_visit(uuid,text,uuid,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.record_visit(uuid,text,uuid,jsonb)', 'EXECUTE') then
    raise exception 'Permisos de record_visit incorrectos';
  end if;

  insert into public.qr_codes (checkpoint_id, public_code, version) values
    ('40000000-0000-4000-8000-000000000001', v_qr_one, 1),
    ('40000000-0000-4000-8000-000000000002', v_qr_two, 1);
  v_shift := public.open_guard_shift(v_guard, v_gate);
  begin
    perform public.record_visit(v_guard, v_qr_one, v_key, '{"status":"unavailable"}');
    raise exception 'Se registró sin ronda';
  exception when others then
    if sqlerrm <> 'NO_ACTIVE_PATROL' then raise; end if;
  end;
  v_patrol := public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
  begin
    perform public.record_visit(v_guard, v_qr_one, v_key,
      '{"status":"captured","latitude":91,"longitude":-90}');
    raise exception 'Se aceptó latitud inválida';
  exception when others then
    if sqlerrm <> 'INVALID_GEO' then raise; end if;
  end;

  v_result := public.record_visit(v_guard, v_qr_one, v_key, '{"status":"denied","client_ip":"203.0.113.7"}');
  v_visit_id := (v_result->>'visit_id')::uuid;
  if v_result->>'outcome' <> 'recorded'
    or (v_result->'progress'->>'visited')::integer <> 1
    or (v_result->'progress'->>'total')::integer <> 2
    or v_result->>'patrol_status' <> 'in_progress'
    or not exists (
      select 1 from public.visits where id = v_visit_id and geo_status = 'denied'
        and client_ip = '203.0.113.7'::inet
        and recorded_at = now() and qr_code_id is not null
    ) then raise exception 'La primera visita no guardó evidencia y progreso'; end if;

  v_result := public.record_visit(v_guard, v_qr_one, v_key, '{"status":"unavailable"}');
  if v_result->>'outcome' <> 'idempotent' or (v_result->>'visit_id')::uuid <> v_visit_id then
    raise exception 'El reintento no devolvió la misma visita'; end if;
  begin
    perform public.record_visit(v_guard, v_qr_two, v_key, '{"status":"unavailable"}');
    raise exception 'Se reutilizó la clave con otro QR';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_CONFLICT' then raise; end if;
  end;
  v_result := public.record_visit(v_guard, v_qr_one, v_other_key, '{"status":"unavailable"}');
  if v_result->>'outcome' <> 'already_scanned' or (v_result->>'visit_id')::uuid <> v_visit_id
    or (select count(*) from public.visits where patrol_id = v_patrol) <> 1 then
    raise exception 'El punto duplicado creó otra visita'; end if;

  v_result := public.record_visit(v_guard, v_qr_two, gen_random_uuid(),
    '{"status":"captured","latitude":14.6349,"longitude":-90.5069,"accuracy_m":12.5}');
  if v_result->>'outcome' <> 'recorded' or v_result->>'patrol_status' <> 'completed'
    or (v_result->'progress'->>'visited')::integer <> 2
    or not exists (select 1 from public.patrols where id = v_patrol and status = 'completed' and ended_at is not null)
    or not exists (select 1 from public.visits where id = (v_result->>'visit_id')::uuid
      and geo_status = 'captured' and latitude = 14.6349 and accuracy_m = 12.5) then
    raise exception 'El último punto no completó la ronda'; end if;
  v_result := public.record_visit(v_guard, v_qr_two, gen_random_uuid(), '{"status":"unavailable"}');
  if v_result->>'outcome' <> 'already_scanned' then
    raise exception 'Duplicado tras cierre automático no reconocido'; end if;

  perform public.rotate_checkpoint_qr(
    '40000000-0000-4000-8000-000000000002', v_qr_rotated, v_admin, 'Prueba T-12');
  v_result := public.record_visit(v_guard, v_qr_one, v_key, '{"status":"unavailable"}');
  if v_result->>'outcome' <> 'idempotent' then
    raise exception 'La rotación afectó al reintento histórico'; end if;
  begin
    perform public.record_visit(v_guard, v_qr_two, gen_random_uuid(), '{"status":"unavailable"}');
    raise exception 'Se aceptó QR revocado';
  exception when others then
    if sqlerrm <> 'INVALID_QR' then raise; end if;
  end;
end $$;
