-- T-11: ejecutar solo en Supabase local con los usuarios ficticios de CI.
do $$
declare
  v_guard uuid;
  v_other uuid;
  v_shift uuid;
  v_patrol uuid;
  v_gate uuid := '20000000-0000-4000-8000-000000000001';
  v_template uuid := '50000000-0000-4000-8000-000000000001';
  v_status text;
begin
  select id into v_guard from public.profiles where employee_code = 'E2E-T11-SQL';
  select id into v_other from public.profiles where employee_code = 'E2E-GUARD';
  if v_guard is null or v_other is null then raise exception 'Faltan guardias de prueba'; end if;
  if has_function_privilege('anon', 'public.open_guard_shift(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.close_guard_patrol(uuid,uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.close_guard_shift(uuid,uuid)', 'EXECUTE') then
    raise exception 'Las funciones T-11 están expuestas a la Data API';
  end if;

  begin
    perform public.open_guard_shift(v_guard, '20000000-0000-4000-8000-000000000002');
    raise exception 'Se permitió una garita no asignada';
  exception when others then
    if sqlerrm <> 'GATE_NOT_ASSIGNED' then raise; end if;
  end;

  v_shift := public.open_guard_shift(v_guard, v_gate);
  if not exists (select 1 from public.shifts where id = v_shift and gate_name_snapshot = 'Garita Central' and ended_at is null) then
    raise exception 'No se creó el turno';
  end if;
  begin
    perform public.open_guard_shift(v_guard, v_gate);
    raise exception 'Se permitieron dos turnos';
  exception when others then
    if sqlerrm <> 'SHIFT_ALREADY_OPEN' then raise; end if;
  end;

  v_patrol := public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
  if (select count(*) from public.patrol_expected_points where patrol_id = v_patrol) <> 2 then
    raise exception 'La ronda no copió sus puntos';
  end if;
  begin
    perform public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
    raise exception 'Se permitieron dos rondas abiertas';
  exception when unique_violation then null;
  end;
  begin
    perform public.close_guard_shift(v_guard, v_shift);
    raise exception 'Se cerró el turno con ronda abierta';
  exception when others then
    if sqlerrm <> 'PATROL_STILL_OPEN' then raise; end if;
  end;
  begin
    perform public.close_guard_patrol(v_other, v_patrol, 'No corresponde');
    raise exception 'Otro guardia cerró la ronda';
  exception when others then
    if sqlerrm <> 'PATROL_NOT_OPEN' then raise; end if;
  end;
  begin
    perform public.close_guard_patrol(v_guard, v_patrol, null);
    raise exception 'Se cerró incompleta sin motivo';
  exception when others then
    if sqlerrm <> 'CLOSURE_REASON_REQUIRED' then raise; end if;
  end;
  v_status := public.close_guard_patrol(v_guard, v_patrol, 'Acceso restringido');
  if v_status <> 'incomplete' or not exists (
    select 1 from public.patrols where id = v_patrol and status = 'incomplete'
      and closure_reason = 'Acceso restringido' and ended_at is not null
  ) then raise exception 'El cierre de ronda no guardó motivo y estado'; end if;
  perform public.close_guard_shift(v_guard, v_shift);
  if not exists (select 1 from public.shifts where id = v_shift and ended_at is not null) then
    raise exception 'El turno no se cerró';
  end if;

  -- La cobertura de todos los puntos obligatorios completa la ronda sin motivo.
  v_shift := public.open_guard_shift(v_guard, v_gate);
  v_patrol := public.start_patrol_with_snapshot(v_shift, v_template, v_guard);
  insert into public.visits (
    patrol_id, checkpoint_id, guard_id, gate_id, idempotency_key,
    checkpoint_name_snapshot, area_name_snapshot
  )
  select v_patrol, ep.checkpoint_id, v_guard, v_gate, gen_random_uuid(),
    ep.checkpoint_name_snapshot, ep.area_name_snapshot
  from public.patrol_expected_points ep
  where ep.patrol_id = v_patrol and ep.required;
  v_status := public.close_guard_patrol(v_guard, v_patrol, null);
  if v_status <> 'completed' or not exists (
    select 1 from public.patrols where id = v_patrol and status = 'completed'
      and closure_reason is null and ended_at is not null
  ) then raise exception 'La ronda con cobertura completa no se cerró como completada'; end if;
  perform public.close_guard_shift(v_guard, v_shift);
end $$;
