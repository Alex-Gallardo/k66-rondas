-- Reconciliación operativa solicitada: las placas físicas 0–4 son K66-PDF-01..05
-- y pertenecen a P-FAES / G-PFAES. No cambia ni revoca sus códigos QR.
-- Ejecutar una sola vez contra producción tras revisar el estado previo.
begin;

do $$
declare
  v_site uuid;
  v_gate uuid;
  v_demo_site uuid;
  v_demo_gate uuid;
  v_old_site uuid;
  v_old_gate uuid;
  v_demo_guard uuid;
  v_demo_template uuid;
  v_area uuid;
  v_template uuid;
  v_count integer;
  v_codes text[] := array[
    'K66-PDF-01', 'K66-PDF-02', 'K66-PDF-03', 'K66-PDF-04', 'K66-PDF-05'
  ];
begin
  perform pg_catalog.pg_advisory_xact_lock(66, pg_catalog.hashtext('escocesa-qr-01-05'));

  select id into v_site from public.sites where code = 'P-FAES' and name = 'PLANTA ESCOCESA' and active;
  select id into v_demo_site from public.sites where code = 'K66-DEMO' and active;
  select id into v_old_site from public.sites where code = 'ESCOCESA-PLANTA' and active;
  select id into v_gate from public.gates where code = 'G-PFAES' and name = 'GARITA ESCOCESA' and site_id = v_site and active;
  select id into v_demo_gate from public.gates where code = 'CENTRAL-DEMO' and site_id = v_demo_site and active;
  select id into v_old_gate from public.gates where code = 'GARITA-ESCOCESA-001' and site_id = v_old_site and active;
  select id into v_demo_guard from public.profiles where employee_code = 'DEMO-001' and role = 'guard' and active;
  select id into v_demo_template from public.patrol_templates where gate_id = v_demo_gate and name = 'Ronda QR 2021';
  if v_site is null or v_gate is null or v_demo_site is null or v_demo_gate is null
     or v_old_site is null or v_old_gate is null or v_demo_guard is null or v_demo_template is null then
    raise exception 'ESC_RECONCILIATION_PREREQUISITE_MISSING';
  end if;

  select count(*) into v_count
  from public.checkpoints c
  join public.areas a on a.id = c.area_id
  join public.qr_codes q on q.checkpoint_id = c.id and q.revoked_at is null and q.legacy_code is not null
  where c.code = any(v_codes) and c.active and a.site_id = v_demo_site;
  if v_count <> 5 then raise exception 'ESC_EXPECTED_FIVE_ACTIVE_DEMO_QRS: %', v_count; end if;
  if exists (
    select 1 from public.patrol_templates
    where gate_id = v_gate and name = 'Ronda Escocesa · placas 0–4'
  ) then raise exception 'ESC_TEMPLATE_ALREADY_EXISTS'; end if;
  if exists (
    select 1 from public.patrols p
    where p.gate_id = v_old_gate and p.status = 'in_progress'
  ) then raise exception 'ESC_OLD_GATE_HAS_OPEN_PATROL'; end if;
  if exists (
    select 1 from public.patrols p
    where p.gate_id = v_demo_gate and p.status = 'in_progress'
      and (p.guard_id <> v_demo_guard or exists (select 1 from public.visits v where v.patrol_id = p.id))
  ) then raise exception 'ESC_DEMO_PATROL_HAS_ACTIVITY'; end if;

  -- Preservar los snapshots históricos, pero cerrar la ronda demo incompleta
  -- antes de mover los puntos a una sede distinta.
  with closed as (
    update public.patrols p
    set status = 'incomplete', ended_at = now(),
        closure_reason = 'Reasignación operativa de puntos 01–05 a Planta Escocesa'
    where p.gate_id = v_demo_gate and p.guard_id = v_demo_guard and p.status = 'in_progress'
    returning p.id
  )
  insert into public.audit_events (action, entity_type, entity_id, metadata)
  select 'patrol.closed_by_operator', 'patrol', id,
         jsonb_build_object('reason', 'escocesa_qr_reconciliation') from closed;

  with closed as (
    update public.shifts sh set ended_at = now()
    where sh.ended_at is null and
      (sh.gate_id = v_old_gate or (sh.gate_id = v_demo_gate and sh.guard_id = v_demo_guard))
    returning sh.id, sh.gate_id
  )
  insert into public.audit_events (action, entity_type, entity_id, metadata)
  select 'shift.closed_by_operator', 'shift', id,
         jsonb_build_object('reason', 'escocesa_qr_reconciliation', 'previous_gate_id', gate_id) from closed;

  insert into public.site_settings (site_id, geo_enabled)
  values (v_site, true) on conflict (site_id) do nothing;

  -- Áreas sugeridas. La ubicación exacta de cada placa sigue sin confirmarse;
  -- por ello los cinco puntos quedan juntos en un área provisional.
  insert into public.areas (site_id, code, name) values
    (v_site, 'FAES-QR-PENDIENTE', 'Puntos instalados · ubicación por confirmar'),
    (v_site, 'FAES-PERIMETRO', 'Perímetro exterior (ejemplo)'),
    (v_site, 'FAES-PRODUCCION', 'Zona de producción (ejemplo)'),
    (v_site, 'FAES-SERVICIOS', 'Servicios y apoyo (ejemplo)')
  on conflict (site_id, code) do nothing;
  select id into v_area from public.areas
  where site_id = v_site and code = 'FAES-QR-PENDIENTE' and active;
  if v_area is null then raise exception 'ESC_PROVISIONAL_AREA_MISSING'; end if;

  update public.checkpoints set area_id = v_area where code = any(v_codes);
  get diagnostics v_count = row_count;
  if v_count <> 5 then raise exception 'ESC_POINT_MOVE_COUNT: %', v_count; end if;

  -- La plantilla demo queda inactiva y sin referencias actuales entre sedes.
  delete from public.template_points tp using public.checkpoints c
  where tp.template_id = v_demo_template and tp.checkpoint_id = c.id and c.code = any(v_codes);
  update public.patrol_templates set active = false, is_default = false where id = v_demo_template;

  update public.patrol_templates set is_default = false
  where gate_id = v_gate and active and is_default;
  insert into public.patrol_templates (gate_id, name, is_default, active)
  values (v_gate, 'Ronda Escocesa · placas 0–4', true, true)
  returning id into v_template;
  insert into public.template_points (template_id, checkpoint_id, position, required)
  select v_template, c.id, row_number() over (order by c.code), true
  from public.checkpoints c where c.code = any(v_codes);

  -- Los dos guardias de la garita Escocesa antigua y la cuenta demo pueden
  -- iniciar una ronda en G-PFAES. No se altera la contraseña de nadie.
  insert into public.gate_assignments (profile_id, gate_id, active)
  select p.id, v_gate, true from public.profiles p
  where p.role = 'guard' and p.active and
    (p.id = v_demo_guard or exists (
      select 1 from public.gate_assignments ga
      where ga.profile_id = p.id and ga.gate_id = v_old_gate and ga.active
    ))
  on conflict (profile_id, gate_id) do update set active = true;

  update public.gate_assignments set active = false
  where gate_id = v_old_gate and active;
  update public.gates set active = false where id = v_old_gate;
  update public.sites set active = false where id = v_old_site;

  insert into public.audit_events (action, entity_type, entity_id, metadata)
  values ('site.points_reconciled', 'site', v_site,
    jsonb_build_object(
      'point_codes', v_codes, 'gate_code', 'G-PFAES',
      'previous_site_code', 'K66-DEMO',
      'retired_site_code', 'ESCOCESA-PLANTA',
      'provisional_area_code', 'FAES-QR-PENDIENTE'
    ));

  if (select count(*) from public.checkpoints c join public.areas a on a.id = c.area_id
      where c.code = any(v_codes) and a.site_id = v_site and a.id = v_area) <> 5
    or (select count(*) from public.template_points where template_id = v_template) <> 5
    or exists (select 1 from public.shifts where gate_id = v_old_gate and ended_at is null)
    or exists (select 1 from public.shifts where guard_id = v_demo_guard and gate_id = v_demo_gate and ended_at is null)
    or exists (select 1 from public.patrols where guard_id = v_demo_guard and gate_id = v_demo_gate and status = 'in_progress')
  then raise exception 'ESC_POSTCONDITION_FAILED'; end if;
end $$;

select c.code as punto, s.code as sede, g.code as garita, a.code as area,
       (select count(*) from public.template_points tp join public.patrol_templates t on t.id = tp.template_id
        where tp.checkpoint_id = c.id and t.gate_id = g.id and t.active) as plantillas_activas
from public.checkpoints c
join public.areas a on a.id = c.area_id
join public.sites s on s.id = a.site_id
join public.gates g on g.site_id = s.id and g.code = 'G-PFAES'
where c.code in ('K66-PDF-01','K66-PDF-02','K66-PDF-03','K66-PDF-04','K66-PDF-05')
order by c.code;

commit;
