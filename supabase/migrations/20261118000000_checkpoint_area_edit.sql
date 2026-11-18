-- Conserva el QR y el historial cuando un administrador reasigna un punto.
create function public.update_checkpoint_area(
  p_checkpoint_id uuid,
  p_area_id uuid,
  p_name text,
  p_description text,
  p_actor_id uuid
) returns integer language plpgsql set search_path = '' as $$
declare
  v_old_area_id uuid;
  v_old_site_id uuid;
  v_new_site_id uuid;
  v_detached integer := 0;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and active
  ) then raise exception 'FORBIDDEN'; end if;

  select c.area_id, a.site_id into v_old_area_id, v_old_site_id
  from public.checkpoints c
  join public.areas a on a.id = c.area_id
  where c.id = p_checkpoint_id
  for update of c;
  if not found then raise exception 'CHECKPOINT_NOT_FOUND'; end if;

  select a.site_id into v_new_site_id
  from public.areas a
  join public.sites s on s.id = a.site_id
  where a.id = p_area_id and a.active and s.active;
  if not found then raise exception 'INVALID_AREA'; end if;

  if v_old_site_id <> v_new_site_id then
    if exists (
      select 1 from public.patrol_expected_points ep
      join public.patrols p on p.id = ep.patrol_id
      where ep.checkpoint_id = p_checkpoint_id and p.status = 'in_progress'
    ) then raise exception 'OPEN_PATROL'; end if;

    if exists (
      select 1 from public.template_points tp
      join public.patrol_templates t on t.id = tp.template_id
      where tp.checkpoint_id = p_checkpoint_id and t.active
    ) then raise exception 'ACTIVE_TEMPLATE'; end if;

    delete from public.template_points tp
    using public.patrol_templates t
    where t.id = tp.template_id and not t.active
      and tp.checkpoint_id = p_checkpoint_id;
    get diagnostics v_detached = row_count;
  end if;

  update public.checkpoints
  set area_id = p_area_id, name = p_name, description = p_description
  where id = p_checkpoint_id;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id, 'checkpoints.update', 'checkpoints', p_checkpoint_id,
    jsonb_build_object(
      'previous_area_id', v_old_area_id,
      'new_area_id', p_area_id,
      'previous_site_id', v_old_site_id,
      'new_site_id', v_new_site_id,
      'detached_templates', v_detached
    )
  );
  return v_detached;
end $$;

revoke all on function public.update_checkpoint_area(uuid,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.update_checkpoint_area(uuid,uuid,text,text,uuid)
  to service_role;
