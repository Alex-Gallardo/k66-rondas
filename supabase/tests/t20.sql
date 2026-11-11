-- T-20: solo service_role puede cambiar la política, con actor y auditoría.
do $$
declare
  v_admin uuid;
  v_guard uuid;
  v_site uuid := '10000000-0000-4000-8000-000000000001';
  v_before bigint;
begin
  select id into v_admin from public.profiles where employee_code = 'E2E-ADMIN';
  select id into v_guard from public.profiles where employee_code = 'E2E-GUARD';
  if v_admin is null or v_guard is null then raise exception 'Faltan usuarios de prueba'; end if;
  if has_function_privilege('anon', 'public.update_site_geo_policy(uuid,uuid,boolean)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.update_site_geo_policy(uuid,uuid,boolean)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.update_site_geo_policy(uuid,uuid,boolean)', 'EXECUTE') then
    raise exception 'Permisos de política incorrectos';
  end if;
  begin
    perform public.update_site_geo_policy(v_guard, v_site, false);
    raise exception 'Un guardia pudo cambiar la política';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
  select count(*) into v_before from public.audit_events
    where action = 'site.policy.geo_updated' and entity_id = v_site;
  perform public.update_site_geo_policy(v_admin, v_site, false);
  if not exists (select 1 from public.site_settings where site_id = v_site and not geo_enabled)
    or not exists (select 1 from public.audit_events
      where actor_id = v_admin and action = 'site.policy.geo_updated'
        and entity_id = v_site and metadata @> '{"previous":true,"current":false}'::jsonb) then
    raise exception 'Cambio GPS o auditoría ausente';
  end if;
  perform public.update_site_geo_policy(v_admin, v_site, false);
  if (select count(*) from public.audit_events
      where action = 'site.policy.geo_updated' and entity_id = v_site) <> v_before + 1 then
    raise exception 'El cambio repetido creó auditoría innecesaria';
  end if;
  perform public.update_site_geo_policy(v_admin, v_site, true);
  if not exists (select 1 from public.site_settings where site_id = v_site and geo_enabled) then
    raise exception 'No se restauró la política';
  end if;
end $$;
