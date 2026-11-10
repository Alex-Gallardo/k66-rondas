-- T-11: las transiciones de turno y ronda se validan dentro de Postgres.
create function public.open_guard_shift(p_actor_id uuid, p_gate_id uuid)
returns uuid language plpgsql set search_path = '' as $$
declare v_shift_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'guard' and active and not must_change_password
  ) then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1 from public.gate_assignments ga
    join public.gates g on g.id = ga.gate_id and g.active
    join public.sites s on s.id = g.site_id and s.active
    where ga.profile_id = p_actor_id and ga.gate_id = p_gate_id and ga.active
  ) then raise exception 'GATE_NOT_ASSIGNED'; end if;
  if exists (select 1 from public.shifts where guard_id = p_actor_id and ended_at is null) then
    raise exception 'SHIFT_ALREADY_OPEN';
  end if;
  insert into public.shifts (guard_id, gate_id, gate_name_snapshot)
  select p_actor_id, id, name from public.gates where id = p_gate_id
  returning id into v_shift_id;
  return v_shift_id;
exception when unique_violation then
  raise exception 'SHIFT_ALREADY_OPEN';
end $$;

create function public.close_guard_patrol(
  p_actor_id uuid, p_patrol_id uuid, p_reason text default null
) returns text language plpgsql set search_path = '' as $$
declare v_patrol public.patrols%rowtype;
declare v_missing integer;
declare v_reason text := nullif(trim(p_reason), '');
declare v_status text;
begin
  select p.* into v_patrol from public.patrols p
  join public.shifts sh on sh.id = p.shift_id
  where p.id = p_patrol_id and p.guard_id = p_actor_id and sh.guard_id = p_actor_id
    and p.status = 'in_progress' and sh.ended_at is null
  for update of p;
  if not found then raise exception 'PATROL_NOT_OPEN'; end if;
  select count(*) into v_missing from public.patrol_expected_points ep
  where ep.patrol_id = p_patrol_id and ep.required
    and not exists (
      select 1 from public.visits v
      where v.patrol_id = p_patrol_id and v.checkpoint_id = ep.checkpoint_id
    );
  if v_missing > 0 and (v_reason is null or length(v_reason) < 4) then
    raise exception 'CLOSURE_REASON_REQUIRED';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'CLOSURE_REASON_TOO_LONG';
  end if;
  v_status := case when v_missing = 0 then 'completed' else 'incomplete' end;
  update public.patrols set status = v_status, ended_at = now(),
    closure_reason = case when v_status = 'incomplete' then v_reason else null end
  where id = p_patrol_id;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'patrol.closed', 'patrol', p_patrol_id,
    jsonb_build_object('status', v_status, 'missing_required', v_missing));
  return v_status;
end $$;

create function public.close_guard_shift(p_actor_id uuid, p_shift_id uuid)
returns timestamptz language plpgsql set search_path = '' as $$
declare v_closed_at timestamptz;
begin
  perform 1 from public.shifts
  where id = p_shift_id and guard_id = p_actor_id and ended_at is null for update;
  if not found then raise exception 'SHIFT_NOT_OPEN'; end if;
  if exists (
    select 1 from public.patrols where shift_id = p_shift_id and status = 'in_progress'
  ) then raise exception 'PATROL_STILL_OPEN'; end if;
  update public.shifts set ended_at = now() where id = p_shift_id
  returning ended_at into v_closed_at;
  insert into public.audit_events (actor_id, action, entity_type, entity_id)
  values (p_actor_id, 'shift.closed', 'shift', p_shift_id);
  return v_closed_at;
end $$;

revoke all on function public.open_guard_shift(uuid,uuid) from public, anon, authenticated;
revoke all on function public.close_guard_patrol(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.close_guard_shift(uuid,uuid) from public, anon, authenticated;
grant execute on function public.open_guard_shift(uuid,uuid) to service_role;
grant execute on function public.close_guard_patrol(uuid,uuid,text) to service_role;
grant execute on function public.close_guard_shift(uuid,uuid) to service_role;
