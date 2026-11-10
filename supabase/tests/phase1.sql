-- Verifica que las migraciones y el seed local dejan una base utilizable
-- sin exponer tablas operativas a la clave pública.
do $$
declare
  app_table text;
  app_tables text[] := array[
    'sites', 'gates', 'areas', 'checkpoints', 'profiles', 'qr_codes',
    'gate_assignments', 'shifts', 'patrol_templates', 'template_points',
    'patrols', 'patrol_expected_points', 'visits', 'visit_photos',
    'audit_events', 'site_settings'
  ];
begin
  foreach app_table in array app_tables loop
    if to_regclass(format('public.%I', app_table)) is null then
      raise exception 'Falta la tabla %', app_table;
    end if;

    if (select c.relrowsecurity from pg_class c where c.oid = to_regclass(format('public.%I', app_table))) then
      raise exception 'RLS inesperado en %', app_table;
    end if;

    if has_table_privilege('anon', format('public.%I', app_table), 'SELECT, INSERT, UPDATE, DELETE')
      or has_table_privilege('authenticated', format('public.%I', app_table), 'SELECT, INSERT, UPDATE, DELETE') then
      raise exception 'Acceso público inesperado a %', app_table;
    end if;

    if not (
      has_table_privilege('service_role', format('public.%I', app_table), 'SELECT')
      and has_table_privilege('service_role', format('public.%I', app_table), 'INSERT')
      and has_table_privilege('service_role', format('public.%I', app_table), 'UPDATE')
      and has_table_privilege('service_role', format('public.%I', app_table), 'DELETE')
    ) then
      raise exception 'Faltan permisos de servidor en %', app_table;
    end if;
  end loop;

  if (select count(*) from public.sites where code = 'PLANTA-DEMO') <> 1 then
    raise exception 'El seed local no cargó la sede de prueba';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'visit-photos' and not public and file_size_limit = 5242880
  ) then
    raise exception 'Falta el bucket privado visit-photos';
  end if;
end $$;
