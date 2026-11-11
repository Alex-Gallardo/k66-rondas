-- IP observada por Vercel al confirmar la visita; no representa coordenadas físicas.
alter table public.visits add column client_ip inet;
create index visits_checkpoint_recorded_idx on public.visits (checkpoint_id, recorded_at desc);

create or replace function public.record_visit(
  p_actor_id uuid,
  p_qr_code text,
  p_idempotency_key uuid,
  p_geo jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  v_visit public.visits%rowtype;
  v_patrol public.patrols%rowtype;
  v_qr record;
  v_expected public.patrol_expected_points%rowtype;
  v_status text;
  v_latitude numeric;
  v_longitude numeric;
  v_accuracy numeric;
  v_captured_at timestamptz;
  v_outcome text := 'recorded';
  v_total integer;
  v_visited integer;
  v_required_total integer;
  v_required_visited integer;
begin
  if p_qr_code is null or p_qr_code !~ '^[0-9a-f]{32}$' or p_idempotency_key is null then
    raise exception 'INVALID_QR_OR_KEY';
  end if;
  -- Un guardia puede enviar desde dos dispositivos. Serializar sus intentos
  -- permite resolver idempotencia antes de que una ronda se cierre automáticamente.
  perform pg_catalog.pg_advisory_xact_lock(66, pg_catalog.hashtext(p_actor_id::text));
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'guard' and active and not must_change_password
  ) then raise exception 'FORBIDDEN'; end if;

  select v.* into v_visit from public.visits v
  where v.guard_id = p_actor_id and v.idempotency_key = p_idempotency_key;
  if found then
    if not exists (
      select 1 from public.qr_codes q
      where q.id = v_visit.qr_code_id and q.public_code = p_qr_code
    ) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    v_outcome := 'idempotent';
  else
    if p_geo is null or jsonb_typeof(p_geo) <> 'object' then
      raise exception 'INVALID_GEO';
    end if;
    v_status := coalesce(p_geo->>'status', 'unavailable');
    if v_status not in ('captured', 'denied', 'timeout', 'unavailable', 'disabled') then
      raise exception 'INVALID_GEO';
    end if;
    if v_status = 'captured' then
      if jsonb_typeof(p_geo->'latitude') <> 'number'
        or jsonb_typeof(p_geo->'longitude') <> 'number'
        or (p_geo ? 'accuracy_m' and jsonb_typeof(p_geo->'accuracy_m') <> 'number') then
        raise exception 'INVALID_GEO';
      end if;
      v_latitude := (p_geo->>'latitude')::numeric;
      v_longitude := (p_geo->>'longitude')::numeric;
      v_accuracy := (p_geo->>'accuracy_m')::numeric;
      if v_latitude not between -90 and 90 or v_longitude not between -180 and 180
        or (v_accuracy is not null and (v_accuracy < 0 or v_accuracy > 100000)) then
        raise exception 'INVALID_GEO';
      end if;
      if p_geo ? 'captured_at' then
        if jsonb_typeof(p_geo->'captured_at') <> 'string' then raise exception 'INVALID_GEO'; end if;
        v_captured_at := (p_geo->>'captured_at')::timestamptz;
      end if;
    elsif p_geo ? 'latitude' or p_geo ? 'longitude' or p_geo ? 'accuracy_m'
      or p_geo ? 'captured_at' then
      raise exception 'INVALID_GEO';
    end if;

    select q.id as qr_id, q.checkpoint_id, c.name as checkpoint_name,
      a.name as area_name, a.site_id
    into v_qr
    from public.qr_codes q
    join public.checkpoints c on c.id = q.checkpoint_id and c.active
    join public.areas a on a.id = c.area_id and a.active
    join public.sites s on s.id = a.site_id and s.active
    where q.public_code = p_qr_code and q.revoked_at is null;
    if not found then raise exception 'INVALID_QR'; end if;

    select p.* into v_patrol from public.patrols p
    join public.shifts sh on sh.id = p.shift_id
    join public.gates g on g.id = p.gate_id and g.active and g.site_id = v_qr.site_id
    join public.gate_assignments ga on ga.gate_id = g.id and ga.profile_id = p_actor_id and ga.active
    where p.guard_id = p_actor_id
      and sh.guard_id = p_actor_id and sh.ended_at is null
    order by (p.status = 'in_progress') desc, p.started_at desc
    limit 1
    for update of p;
    if not found then raise exception 'NO_ACTIVE_PATROL'; end if;
    select v.* into v_visit from public.visits v
    where v.patrol_id = v_patrol.id and v.checkpoint_id = v_qr.checkpoint_id;
    if found then
      v_outcome := 'already_scanned';
    else
      if v_patrol.status <> 'in_progress' then raise exception 'NO_ACTIVE_PATROL'; end if;
      select ep.* into v_expected from public.patrol_expected_points ep
      where ep.patrol_id = v_patrol.id and ep.checkpoint_id = v_qr.checkpoint_id;
      if not found then raise exception 'POINT_NOT_EXPECTED'; end if;
      insert into public.visits (
        patrol_id, checkpoint_id, guard_id, gate_id, idempotency_key, qr_code_id,
        checkpoint_name_snapshot, area_name_snapshot, geo_status,
        latitude, longitude, accuracy_m, geo_captured_at, client_ip
      ) values (
        v_patrol.id, v_qr.checkpoint_id, p_actor_id, v_patrol.gate_id,
        p_idempotency_key, v_qr.qr_id, v_expected.checkpoint_name_snapshot,
        v_expected.area_name_snapshot, v_status, v_latitude, v_longitude,
        v_accuracy, v_captured_at, nullif(p_geo->>'client_ip', '')::inet
      ) returning * into v_visit;
      if not exists (
        select 1 from public.patrol_expected_points ep
        where ep.patrol_id = v_patrol.id and not exists (
          select 1 from public.visits v
          where v.patrol_id = v_patrol.id and v.checkpoint_id = ep.checkpoint_id
        )
      ) then
        update public.patrols set status = 'completed', ended_at = now()
        where id = v_patrol.id;
      end if;
    end if;
  end if;

  select count(*), count(*) filter (where ep.required),
    count(*) filter (where v.id is not null),
    count(*) filter (where ep.required and v.id is not null)
  into v_total, v_required_total, v_visited, v_required_visited
  from public.patrol_expected_points ep
  left join public.visits v on v.patrol_id = ep.patrol_id and v.checkpoint_id = ep.checkpoint_id
  where ep.patrol_id = v_visit.patrol_id;
  select status into v_status from public.patrols where id = v_visit.patrol_id;
  return jsonb_build_object(
    'outcome', v_outcome,
    'visit_id', v_visit.id,
    'patrol_id', v_visit.patrol_id,
    'recorded_at', v_visit.recorded_at,
    'checkpoint_id', v_visit.checkpoint_id,
    'checkpoint_name', v_visit.checkpoint_name_snapshot,
    'area_name', v_visit.area_name_snapshot,
    'patrol_status', v_status,
    'progress', jsonb_build_object(
      'visited', v_visited, 'total', v_total,
      'required_visited', v_required_visited, 'required_total', v_required_total
    )
  );
end $$;

revoke all on function public.record_visit(uuid,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.record_visit(uuid,text,uuid,jsonb) to service_role;
