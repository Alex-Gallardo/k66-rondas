-- Fixture y verificación de indicadores para exportaciones (solo CI local).
do $$
declare
  v_note_only uuid;
  v_both uuid;
  v_photo_only uuid;
  v_empty uuid;
begin
  select v.id into v_note_only from public.visits v
    join public.profiles p on p.id = v.guard_id
    where p.employee_code = 'E2E-T12-SQL'
    order by v.recorded_at, v.id limit 1;
  select v.id into v_both from public.visits v
    join public.profiles p on p.id = v.guard_id
    where p.employee_code = 'E2E-T12-SQL' and v.id <> v_note_only
    order by v.recorded_at, v.id limit 1;
  select v.id into v_photo_only from public.visits v
    join public.profiles p on p.id = v.guard_id
    where p.employee_code = 'E2E-T17-OTHER' limit 1;
  select v.id into v_empty from public.visits v
    join public.profiles p on p.id = v.guard_id
    where p.employee_code = 'E2E-T18-SQL' limit 1;
  if v_note_only is null or v_both is null or v_photo_only is null or v_empty is null then
    raise exception 'Faltan visitas para probar evidencia';
  end if;

  update public.visits set note = '   ' where id = v_empty;
  if (select has_observation from public.visits where id = v_empty) then
    raise exception 'Espacios no cuentan como observación';
  end if;
  update public.visits set note = null where id = v_empty;

  update public.visits set note = '=SUM(1,1)' where id = v_note_only;
  update public.visits set note = 'Puerta abierta' where id = v_both;
  insert into public.visit_photos (visit_id, storage_path, mime_type, bytes, uploaded_by)
    select id, 'tests/export-' || id::text, 'image/jpeg', 1, guard_id
    from public.visits where id = v_note_only;
  if not (select has_photo from public.visits where id = v_note_only) then
    raise exception 'El trigger no marcó la foto';
  end if;
  delete from public.visit_photos where visit_id = v_note_only;
  if (select has_photo from public.visits where id = v_note_only) then
    raise exception 'El trigger no quitó la foto';
  end if;
  insert into public.visit_photos (visit_id, storage_path, mime_type, bytes, uploaded_by)
    select id, 'tests/export-' || id::text, 'image/jpeg', 1, guard_id
    from public.visits where id in (v_both, v_photo_only);

  if not exists (
    select 1 from public.visits where id = v_note_only
      and has_observation and not has_photo
  ) or not exists (
    select 1 from public.visits where id = v_both
      and has_observation and has_photo
  ) or not exists (
    select 1 from public.visits where id = v_photo_only
      and not has_observation and has_photo
  ) or not exists (
    select 1 from public.visits where id = v_empty
      and not has_observation and not has_photo
  ) then raise exception 'Las cuatro combinaciones de evidencia no coinciden'; end if;
end $$;
