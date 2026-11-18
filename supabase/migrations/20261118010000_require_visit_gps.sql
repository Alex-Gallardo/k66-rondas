-- Los registros históricos sin GPS se conservan; los nuevos requieren coordenadas.
update public.site_settings
set geo_enabled = true, updated_at = now()
where not geo_enabled;

alter table public.site_settings
  add constraint site_settings_gps_required check (geo_enabled);

create function public.require_visit_gps()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.geo_status <> 'captured'
    or new.latitude is null
    or new.longitude is null then
    raise exception 'GEO_REQUIRED';
  end if;
  return new;
end $$;

create trigger visits_require_gps
before insert on public.visits
for each row execute function public.require_visit_gps();

revoke all on function public.require_visit_gps() from public, anon, authenticated;
grant execute on function public.require_visit_gps() to service_role;

-- La función antigua sigue disponible para compatibilidad, pero no puede
-- desactivar la ubicación obligatoria.
create or replace function public.update_site_geo_policy(
  p_actor_id uuid, p_site_id uuid, p_geo_enabled boolean
) returns boolean language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and active
      and not must_change_password
  ) then raise exception 'FORBIDDEN'; end if;
  if p_geo_enabled is distinct from true then raise exception 'GPS_REQUIRED'; end if;
  if not exists (
    select 1 from public.sites where id = p_site_id and active
  ) then raise exception 'SITE_NOT_FOUND'; end if;
  return true;
end $$;
