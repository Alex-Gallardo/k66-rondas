-- Se ejecuta únicamente contra Supabase local tras scripts/seed-ci-users.mjs.
do $$
declare
  admin_id uuid;
  v_guard_id uuid;
  pending_id uuid;
  v_gate_id uuid := '20000000-0000-4000-8000-000000000001';
  seed_point uuid := '40000000-0000-4000-8000-000000000001';
  new_point uuid;
  v_template_id uuid;
  v_shift_id uuid;
  v_patrol_id uuid;
  v_version integer;
begin
  select id into admin_id from public.profiles where employee_code = 'E2E-ADMIN';
  select id into v_guard_id from public.profiles where employee_code = 'E2E-GUARD';
  select id into pending_id from auth.users where email = 'e2e-pending@accounts.k66.example';
  if admin_id is null or v_guard_id is null or pending_id is null then raise exception 'Faltan usuarios de prueba'; end if;

  if has_function_privilege('anon', 'public.create_checkpoint_with_qr(uuid,text,text,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.rotate_checkpoint_qr(uuid,text,uuid,text)', 'EXECUTE') then
    raise exception 'Las funciones administrativas están expuestas';
  end if;

  perform public.create_profile_with_gates(pending_id, 'E2E-NEW', 'Usuario Nuevo', 'guard', array[v_gate_id], admin_id);
  if not exists (select 1 from public.gate_assignments where profile_id = pending_id and gate_id = v_gate_id and active) then
    raise exception 'El alta de usuario no creó la asignación';
  end if;
  perform public.update_profile_with_gates(pending_id, 'Usuario Actualizado', 'supervisor', true, array[v_gate_id], admin_id);
  if not exists (select 1 from public.profiles where id = pending_id and role = 'supervisor' and full_name = 'Usuario Actualizado') then
    raise exception 'La actualización del usuario falló';
  end if;

  new_point := public.create_checkpoint_with_qr(
    '30000000-0000-4000-8000-000000000001', 'E2E-CP-01', 'Punto de Prueba', null,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', admin_id
  );
  v_version := public.rotate_checkpoint_qr(new_point, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', admin_id, 'Prueba de rotación');
  if v_version <> 2 or
    (select count(*) from public.qr_codes where checkpoint_id = new_point and revoked_at is null) <> 1 or
    not exists (select 1 from public.qr_codes where checkpoint_id = new_point and version = 1 and revoked_at is not null) then
    raise exception 'La rotación QR no preservó las versiones';
  end if;

  v_template_id := public.save_patrol_template(null, v_gate_id, 'Prueba de Ronda', true,
    jsonb_build_array(
      jsonb_build_object('checkpoint_id', seed_point, 'required', true),
      jsonb_build_object('checkpoint_id', new_point, 'required', false)
    ), admin_id);
  insert into public.shifts (guard_id, gate_id, gate_name_snapshot)
  values (v_guard_id, v_gate_id, 'Garita Central') returning id into v_shift_id;
  v_patrol_id := public.start_patrol_with_snapshot(v_shift_id, v_template_id, v_guard_id);
  if (select count(*) from public.patrol_expected_points where patrol_id = v_patrol_id) <> 2 then
    raise exception 'La ronda no copió sus puntos';
  end if;

  perform public.save_patrol_template(v_template_id, v_gate_id, 'Prueba Editada', true,
    jsonb_build_array(jsonb_build_object('checkpoint_id', seed_point, 'required', true)), admin_id);
  if (select count(*) from public.template_points where template_id = v_template_id) <> 1 or
     (select count(*) from public.patrol_expected_points where patrol_id = v_patrol_id) <> 2 then
    raise exception 'Editar plantilla alteró la ronda histórica';
  end if;
end $$;
