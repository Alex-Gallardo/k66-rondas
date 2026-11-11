-- La política GPS se cambia junto con su evento de auditoría en una transacción.
create function public.update_site_geo_policy(
  p_actor_id uuid, p_site_id uuid, p_geo_enabled boolean
) returns boolean language plpgsql set search_path = '' as $$
declare
  v_previous boolean;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and active and not must_change_password
  ) then raise exception 'FORBIDDEN'; end if;
  if p_geo_enabled is null then raise exception 'INVALID_POLICY'; end if;
  perform 1 from public.sites where id = p_site_id and active for update;
  if not found then raise exception 'SITE_NOT_FOUND'; end if;

  select geo_enabled into v_previous from public.site_settings
  where site_id = p_site_id for update;
  v_previous := coalesce(v_previous, true);
  insert into public.site_settings (site_id, geo_enabled)
  values (p_site_id, p_geo_enabled)
  on conflict (site_id) do update
    set geo_enabled = excluded.geo_enabled, updated_at = now();
  if v_previous is distinct from p_geo_enabled then
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (p_actor_id, 'site.policy.geo_updated', 'site', p_site_id,
      jsonb_build_object('previous', v_previous, 'current', p_geo_enabled));
  end if;
  return p_geo_enabled;
end $$;

revoke all on function public.update_site_geo_policy(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.update_site_geo_policy(uuid,uuid,boolean) to service_role;
