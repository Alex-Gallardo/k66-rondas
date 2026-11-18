-- Verifica que una ronda abierta no pierda un punto al moverlo de sede.
do $$
declare
  v_admin uuid;
  v_point uuid;
  v_area uuid;
begin
  select id into v_admin from public.profiles where employee_code = 'E2E-ADMIN';
  select id into v_point from public.checkpoints where code = 'E2E-CP-01';
  if v_admin is null or v_point is null then
    raise exception 'Faltan datos de la prueba';
  end if;

  if has_function_privilege('anon',
      'public.update_checkpoint_area(uuid,uuid,text,text,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.update_checkpoint_area(uuid,uuid,text,text,uuid)', 'EXECUTE')
    or not has_function_privilege('service_role',
      'public.update_checkpoint_area(uuid,uuid,text,text,uuid)', 'EXECUTE') then
    raise exception 'Permisos incorrectos para mover puntos';
  end if;

  insert into public.sites (code, name)
  values ('E2E-MOVE-DEST', 'Destino de prueba') returning id into v_area;
  insert into public.areas (site_id, code, name)
  values (v_area, 'MOVE-DEST', 'Nueva área') returning id into v_area;

  begin
    perform public.update_checkpoint_area(v_point, v_area, 'Punto de Prueba', null, v_admin);
    raise exception 'Se movió un punto con ronda abierta';
  exception when others then
    if sqlerrm <> 'OPEN_PATROL' then raise; end if;
  end;

  if not exists (
    select 1 from public.checkpoints
    where id = v_point and area_id = '30000000-0000-4000-8000-000000000001'
  ) then raise exception 'El punto cambió de área tras el rechazo'; end if;
end $$;
