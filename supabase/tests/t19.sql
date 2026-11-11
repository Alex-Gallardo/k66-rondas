-- T-19: agregados por sede, garita y día local, sin acceso desde Data API pública.
do $$
declare
  v_site uuid := '10000000-0000-4000-8000-000000000001';
  v_central uuid := '20000000-0000-4000-8000-000000000001';
  v_anexa uuid := '20000000-0000-4000-8000-000000000002';
  v_day date := timezone('America/Guatemala', now())::date;
  v_start timestamptz;
  v_end timestamptz;
  v_data jsonb;
  v_expected integer;
begin
  if has_function_privilege('anon', 'public.dashboard_metrics(uuid,uuid[],timestamptz,timestamptz,date,date)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.dashboard_metrics(uuid,uuid[],timestamptz,timestamptz,date,date)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.dashboard_metrics(uuid,uuid[],timestamptz,timestamptz,date,date)', 'EXECUTE') then
    raise exception 'Permisos del dashboard incorrectos';
  end if;
  v_start := v_day::timestamp at time zone 'America/Guatemala';
  v_end := (v_day + 1)::timestamp at time zone 'America/Guatemala';
  v_data := public.dashboard_metrics(v_site, array[v_central], v_start, v_end, v_day, v_day);
  select count(*) into v_expected from public.visits
    where gate_id = v_central and recorded_at >= v_start and recorded_at < v_end;
  if (v_data->>'visits')::integer <> v_expected
    or (v_data->'daily'->0->>'visits')::integer <> v_expected
    or (v_data->>'rounds_started')::integer <> (
      select count(*) from public.patrols
      where gate_id = v_central and started_at >= v_start and started_at < v_end
    ) then raise exception 'Conteos del dashboard no coinciden con la base'; end if;
  if (v_data->>'required_visited')::integer > (v_data->>'required_expected')::integer
    or (v_data->>'active_guards')::integer > (v_data->>'assigned_guards')::integer
    or jsonb_array_length(v_data->'daily') <> 1 then
    raise exception 'Denominadores o serie diaria inválidos'; end if;

  v_data := public.dashboard_metrics(v_site, array[v_anexa], v_start, v_end, v_day, v_day);
  if (v_data->>'visits')::integer <> 1 or (v_data->>'rounds_started')::integer <> 1
    or (v_data->>'geo_captured')::integer <> 1 then
    raise exception 'El filtro de garita anexa no aisló los datos'; end if;

  v_data := public.dashboard_metrics(v_site, array[]::uuid[], v_start, v_end, v_day, v_day);
  if (v_data->>'visits')::integer <> 0 or (v_data->>'rounds_started')::integer <> 0
    or (v_data->>'assigned_guards')::integer <> 0 then
    raise exception 'Un alcance vacío expuso información'; end if;
end $$;
