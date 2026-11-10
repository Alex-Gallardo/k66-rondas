-- K66 Rondas · esquema inicial del MVP.
-- No se habilita RLS. Las tablas operativas solo son accesibles desde el servidor.

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  timezone text not null default 'America/Guatemala',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint sites_code_format check (code ~ '^[A-Z0-9_-]{2,32}$'),
  constraint sites_name_nonempty check (length(trim(name)) > 0)
);

create table public.gates (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, code),
  constraint gates_code_nonempty check (length(trim(code)) > 0),
  constraint gates_name_nonempty check (length(trim(name)) > 0)
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  parent_id uuid,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (site_id, id),
  unique (site_id, code),
  foreign key (site_id, parent_id) references public.areas(site_id, id) on delete restrict,
  constraint areas_not_own_parent check (parent_id is null or parent_id <> id),
  constraint areas_code_nonempty check (length(trim(code)) > 0),
  constraint areas_name_nonempty check (length(trim(name)) > 0)
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  installed_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint checkpoints_code_nonempty check (length(trim(code)) > 0),
  constraint checkpoints_name_nonempty check (length(trim(name)) > 0)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  employee_code text not null unique,
  full_name text not null,
  role text not null default 'guard',
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('guard', 'supervisor', 'admin')),
  constraint profiles_employee_code_nonempty check (length(trim(employee_code)) > 0),
  constraint profiles_full_name_nonempty check (length(trim(full_name)) > 0)
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  public_code text not null unique,
  version integer not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (checkpoint_id, version),
  constraint qr_codes_version_positive check (version > 0),
  constraint qr_codes_public_code_format check (public_code ~ '^[0-9a-f]{32}$')
);

create unique index qr_codes_one_active_per_checkpoint
  on public.qr_codes (checkpoint_id) where revoked_at is null;

create table public.gate_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  gate_id uuid not null references public.gates(id) on delete restrict,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (profile_id, gate_id)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null references public.profiles(id) on delete restrict,
  gate_id uuid not null references public.gates(id) on delete restrict,
  gate_name_snapshot text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint shifts_end_after_start check (ended_at is null or ended_at >= started_at)
);

create unique index shifts_one_open_per_guard
  on public.shifts (guard_id) where ended_at is null;

create table public.patrol_templates (
  id uuid primary key default gen_random_uuid(),
  gate_id uuid not null references public.gates(id) on delete restrict,
  name text not null,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint patrol_templates_name_nonempty check (length(trim(name)) > 0)
);

create unique index patrol_templates_one_default_per_gate
  on public.patrol_templates (gate_id) where is_default and active;

create table public.template_points (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.patrol_templates(id) on delete restrict,
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  position integer not null,
  required boolean not null default true,
  unique (template_id, checkpoint_id),
  unique (template_id, position),
  constraint template_points_position_positive check (position > 0)
);

create table public.patrols (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete restrict,
  template_id uuid not null references public.patrol_templates(id) on delete restrict,
  guard_id uuid not null references public.profiles(id) on delete restrict,
  gate_id uuid not null references public.gates(id) on delete restrict,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  closure_reason text,
  constraint patrols_status_check check (status in ('in_progress', 'completed', 'incomplete')),
  constraint patrols_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint patrols_status_end_consistent check ((status = 'in_progress' and ended_at is null) or (status <> 'in_progress' and ended_at is not null))
);

create unique index patrols_one_open_per_shift
  on public.patrols (shift_id) where status = 'in_progress';

create table public.patrol_expected_points (
  id uuid primary key default gen_random_uuid(),
  patrol_id uuid not null references public.patrols(id) on delete restrict,
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  position integer not null,
  required boolean not null,
  checkpoint_name_snapshot text not null,
  area_name_snapshot text not null,
  unique (patrol_id, checkpoint_id),
  unique (patrol_id, position),
  constraint patrol_expected_points_position_positive check (position > 0)
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  patrol_id uuid not null references public.patrols(id) on delete restrict,
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  guard_id uuid not null references public.profiles(id) on delete restrict,
  gate_id uuid not null references public.gates(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  note text,
  note_updated_at timestamptz,
  geo_status text not null default 'unavailable',
  latitude numeric(9,6),
  longitude numeric(9,6),
  accuracy_m numeric(10,2),
  geo_captured_at timestamptz,
  idempotency_key uuid not null,
  checkpoint_name_snapshot text not null,
  area_name_snapshot text not null,
  unique (patrol_id, checkpoint_id),
  unique (guard_id, idempotency_key),
  constraint visits_note_length check (note is null or length(note) <= 1000),
  constraint visits_geo_status_check check (geo_status in ('captured', 'denied', 'timeout', 'unavailable', 'disabled')),
  constraint visits_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint visits_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint visits_accuracy_positive check (accuracy_m is null or accuracy_m >= 0),
  constraint visits_geo_consistent check (
    (geo_status = 'captured' and latitude is not null and longitude is not null)
    or (geo_status <> 'captured' and latitude is null and longitude is null)
  )
);

create table public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.visits(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null,
  bytes integer not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  constraint visit_photos_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint visit_photos_size_check check (bytes > 0 and bytes <= 5242880)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.site_settings (
  site_id uuid primary key references public.sites(id) on delete restrict,
  idle_logout_minutes integer not null default 30,
  photo_retention_days integer not null default 90,
  geo_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint site_settings_idle_positive check (idle_logout_minutes between 5 and 240),
  constraint site_settings_retention_positive check (photo_retention_days between 1 and 3650)
);

create index gates_site_idx on public.gates (site_id);
create index areas_site_parent_idx on public.areas (site_id, parent_id);
create index checkpoints_area_active_idx on public.checkpoints (area_id, active);
create index qr_codes_checkpoint_idx on public.qr_codes (checkpoint_id);
create index gate_assignments_gate_active_idx on public.gate_assignments (gate_id, active);
create index shifts_guard_started_idx on public.shifts (guard_id, started_at desc);
create index patrols_gate_started_idx on public.patrols (gate_id, started_at desc);
create index patrol_expected_points_patrol_idx on public.patrol_expected_points (patrol_id, position);
create index visits_recorded_idx on public.visits (recorded_at desc);
create index visits_gate_recorded_idx on public.visits (gate_id, recorded_at desc);
create index visits_guard_recorded_idx on public.visits (guard_id, recorded_at desc);
create index audit_events_occurred_idx on public.audit_events (occurred_at desc);

-- La clave pública se usa solo para Auth. Ninguna tabla operativa acepta Data API
-- con los roles anon o authenticated; las rutas Next.js usan service_role.
do $$
declare app_table text;
begin
  foreach app_table in array array[
    'sites', 'gates', 'areas', 'checkpoints', 'profiles', 'qr_codes',
    'gate_assignments', 'shifts', 'patrol_templates', 'template_points',
    'patrols', 'patrol_expected_points', 'visits', 'visit_photos',
    'audit_events', 'site_settings'
  ] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', app_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', app_table);
  end loop;
end $$;
