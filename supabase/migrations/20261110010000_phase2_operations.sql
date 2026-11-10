-- Operaciones administrativas atómicas. Todas requieren service_role y
-- vuelven a comprobar que el actor sea un administrador activo.

create function public.create_profile_with_gates(
  p_user_id uuid, p_employee_code text, p_full_name text, p_role text,
  p_gate_ids uuid[], p_actor_id uuid
) returns uuid language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('guard', 'supervisor', 'admin') then raise exception 'INVALID_ROLE'; end if;
  if p_role <> 'admin' and cardinality(p_gate_ids) = 0 then raise exception 'GATE_REQUIRED'; end if;
  if (select count(distinct id) from public.gates where id = any(p_gate_ids) and active) <> cardinality(p_gate_ids) then
    raise exception 'INVALID_GATES';
  end if;
  insert into public.profiles (id, employee_code, full_name, role)
  values (p_user_id, p_employee_code, p_full_name, p_role);
  insert into public.gate_assignments (profile_id, gate_id)
  select p_user_id, unnest(p_gate_ids);
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'user.created', 'profile', p_user_id, jsonb_build_object('role', p_role, 'gate_count', cardinality(p_gate_ids)));
  return p_user_id;
end $$;

create function public.update_profile_with_gates(
  p_user_id uuid, p_full_name text, p_role text, p_active boolean,
  p_gate_ids uuid[], p_actor_id uuid
) returns uuid language plpgsql set search_path = '' as $$
declare old_role text;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('guard', 'supervisor', 'admin') then raise exception 'INVALID_ROLE'; end if;
  select role into old_role from public.profiles where id = p_user_id for update;
  if old_role is null then raise exception 'USER_NOT_FOUND'; end if;
  if p_user_id = p_actor_id and (not p_active or p_role <> 'admin') then raise exception 'CANNOT_DEMOTE_SELF'; end if;
  if old_role = 'admin' and (p_role <> 'admin' or not p_active) and
    not exists (select 1 from public.profiles where id <> p_user_id and role = 'admin' and active) then
    raise exception 'LAST_ADMIN';
  end if;
  if p_active and p_role <> 'admin' and cardinality(p_gate_ids) = 0 then raise exception 'GATE_REQUIRED'; end if;
  if (select count(distinct id) from public.gates where id = any(p_gate_ids) and active) <> cardinality(p_gate_ids) then
    raise exception 'INVALID_GATES';
  end if;
  update public.profiles set full_name = p_full_name, role = p_role, active = p_active where id = p_user_id;
  update public.gate_assignments set active = false where profile_id = p_user_id;
  insert into public.gate_assignments (profile_id, gate_id)
  select p_user_id, unnest(p_gate_ids)
  on conflict (profile_id, gate_id) do update set active = true;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'user.updated', 'profile', p_user_id, jsonb_build_object('role', p_role, 'active', p_active, 'gate_count', cardinality(p_gate_ids)));
  return p_user_id;
end $$;

create function public.create_checkpoint_with_qr(
  p_area_id uuid, p_code text, p_name text, p_description text,
  p_public_code text, p_actor_id uuid
) returns uuid language plpgsql set search_path = '' as $$
declare new_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.areas a join public.sites s on s.id = a.site_id
    where a.id = p_area_id and a.active and s.active
  ) then raise exception 'INVALID_AREA'; end if;
  if p_public_code !~ '^[0-9a-f]{32}$' then raise exception 'INVALID_QR_CODE'; end if;
  insert into public.checkpoints (area_id, code, name, description)
  values (p_area_id, p_code, p_name, p_description) returning id into new_id;
  insert into public.qr_codes (checkpoint_id, public_code, version, created_by)
  values (new_id, p_public_code, 1, p_actor_id);
  insert into public.audit_events (actor_id, action, entity_type, entity_id)
  values (p_actor_id, 'checkpoint.created', 'checkpoint', new_id);
  return new_id;
end $$;

create function public.rotate_checkpoint_qr(
  p_checkpoint_id uuid, p_public_code text, p_actor_id uuid, p_reason text
) returns integer language plpgsql set search_path = '' as $$
declare next_version integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'FORBIDDEN';
  end if;
  if length(trim(p_reason)) < 4 then raise exception 'REASON_REQUIRED'; end if;
  if p_public_code !~ '^[0-9a-f]{32}$' then raise exception 'INVALID_QR_CODE'; end if;
  perform 1 from public.checkpoints where id = p_checkpoint_id and active for update;
  if not found then raise exception 'CHECKPOINT_NOT_FOUND'; end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.qr_codes where checkpoint_id = p_checkpoint_id;
  update public.qr_codes set revoked_at = now()
  where checkpoint_id = p_checkpoint_id and revoked_at is null;
  insert into public.qr_codes (checkpoint_id, public_code, version, created_by)
  values (p_checkpoint_id, p_public_code, next_version, p_actor_id);
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'qr.rotated', 'checkpoint', p_checkpoint_id, jsonb_build_object('version', next_version, 'reason', p_reason));
  return next_version;
end $$;

create function public.save_patrol_template(
  p_template_id uuid, p_gate_id uuid, p_name text, p_is_default boolean,
  p_points jsonb, p_actor_id uuid
) returns uuid language plpgsql set search_path = '' as $$
declare result_id uuid;
declare site_id uuid;
declare point_count integer;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'FORBIDDEN';
  end if;
  select g.site_id into site_id from public.gates g join public.sites s on s.id = g.site_id
  where g.id = p_gate_id and g.active and s.active;
  if site_id is null then raise exception 'INVALID_GATE'; end if;
  if jsonb_typeof(p_points) <> 'array' or jsonb_array_length(p_points) = 0 then raise exception 'POINTS_REQUIRED'; end if;
  select count(*) into point_count from jsonb_array_elements(p_points) p
    join public.checkpoints c on c.id = (p.value->>'checkpoint_id')::uuid and c.active
    join public.areas a on a.id = c.area_id and a.active and a.site_id = site_id;
  if point_count <> jsonb_array_length(p_points) or
    (select count(distinct p.value->>'checkpoint_id') from jsonb_array_elements(p_points) p) <> point_count then
    raise exception 'INVALID_POINTS';
  end if;
  if p_template_id is null then
    insert into public.patrol_templates (gate_id, name, is_default) values (p_gate_id, p_name, false)
    returning id into result_id;
  else
    select id into result_id from public.patrol_templates where id = p_template_id and gate_id = p_gate_id for update;
    if result_id is null then raise exception 'TEMPLATE_NOT_FOUND'; end if;
    update public.patrol_templates set name = p_name, active = true where id = result_id;
  end if;
  if p_is_default then
    update public.patrol_templates set is_default = false where gate_id = p_gate_id and is_default;
  end if;
  update public.patrol_templates set is_default = p_is_default where id = result_id;
  delete from public.template_points where template_id = result_id;
  insert into public.template_points (template_id, checkpoint_id, position, required)
  select result_id, (p.value->>'checkpoint_id')::uuid, p.ordinality::integer,
    coalesce((p.value->>'required')::boolean, true)
  from jsonb_array_elements(p_points) with ordinality as p(value, ordinality);
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'template.saved', 'patrol_template', result_id, jsonb_build_object('point_count', point_count));
  return result_id;
end $$;

-- El guardia iniciará la ronda mediante esta operación en Fase 3.
-- La copia de puntos esperados ya se conserva aquí, dentro de la transacción.
create function public.start_patrol_with_snapshot(
  p_shift_id uuid, p_template_id uuid, p_actor_id uuid
) returns uuid language plpgsql set search_path = '' as $$
declare shift_gate uuid;
declare new_patrol uuid;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'guard' and active and not must_change_password) then
    raise exception 'FORBIDDEN';
  end if;
  select gate_id into shift_gate from public.shifts
  where id = p_shift_id and guard_id = p_actor_id and ended_at is null for update;
  if shift_gate is null then raise exception 'SHIFT_NOT_FOUND'; end if;
  if not exists (select 1 from public.gate_assignments where profile_id = p_actor_id and gate_id = shift_gate and active) then
    raise exception 'GATE_NOT_ASSIGNED';
  end if;
  if not exists (select 1 from public.patrol_templates where id = p_template_id and gate_id = shift_gate and active) then
    raise exception 'TEMPLATE_NOT_FOUND';
  end if;
  if not exists (select 1 from public.template_points where template_id = p_template_id) then
    raise exception 'EMPTY_TEMPLATE';
  end if;
  insert into public.patrols (shift_id, template_id, guard_id, gate_id)
  values (p_shift_id, p_template_id, p_actor_id, shift_gate) returning id into new_patrol;
  insert into public.patrol_expected_points
    (patrol_id, checkpoint_id, position, required, checkpoint_name_snapshot, area_name_snapshot)
  select new_patrol, tp.checkpoint_id, tp.position, tp.required, c.name, a.name
  from public.template_points tp
  join public.checkpoints c on c.id = tp.checkpoint_id and c.active
  join public.areas a on a.id = c.area_id and a.active
  where tp.template_id = p_template_id;
  if (select count(*) from public.patrol_expected_points where patrol_id = new_patrol) <>
     (select count(*) from public.template_points where template_id = p_template_id) then
    raise exception 'INACTIVE_TEMPLATE_POINT';
  end if;
  return new_patrol;
end $$;

revoke all on function public.create_profile_with_gates(uuid,text,text,text,uuid[],uuid) from public, anon, authenticated;
revoke all on function public.update_profile_with_gates(uuid,text,text,boolean,uuid[],uuid) from public, anon, authenticated;
revoke all on function public.create_checkpoint_with_qr(uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.rotate_checkpoint_qr(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.save_patrol_template(uuid,uuid,text,boolean,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.start_patrol_with_snapshot(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_profile_with_gates(uuid,text,text,text,uuid[],uuid) to service_role;
grant execute on function public.update_profile_with_gates(uuid,text,text,boolean,uuid[],uuid) to service_role;
grant execute on function public.create_checkpoint_with_qr(uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.rotate_checkpoint_qr(uuid,text,uuid,text) to service_role;
grant execute on function public.save_patrol_template(uuid,uuid,text,boolean,jsonb,uuid) to service_role;
grant execute on function public.start_patrol_with_snapshot(uuid,uuid,uuid) to service_role;
