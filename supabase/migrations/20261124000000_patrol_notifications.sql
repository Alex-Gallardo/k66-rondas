create table public.patrol_schedules (
  id uuid primary key default gen_random_uuid(),
  gate_id uuid not null references public.gates(id),
  template_id uuid not null references public.patrol_templates(id),
  guard_id uuid not null references public.profiles(id),
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  local_time time not null,
  timezone text not null,
  starts_on date not null,
  ends_on date check (ends_on >= starts_on),
  advance_minutes smallint not null check (advance_minutes between 1 and 120),
  start_grace_minutes smallint not null check (start_grace_minutes between 1 and 120),
  finish_minutes smallint not null check (finish_minutes between start_grace_minutes and 240),
  notify_at_start boolean not null default false,
  active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.patrol_occurrences (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.patrol_schedules(id),
  rule_revision integer not null,
  gate_id uuid not null references public.gates(id),
  template_id uuid not null references public.patrol_templates(id),
  guard_id uuid references public.profiles(id),
  timezone text not null,
  local_date date not null,
  scheduled_at timestamptz not null,
  remind_at timestamptz not null,
  start_until timestamptz not null,
  finish_by timestamptz not null,
  notify_at_start boolean not null,
  assignment_version integer not null default 1,
  status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','completed','incomplete','missed','cancelled','unassigned')),
  assignment_issue text,
  patrol_id uuid unique references public.patrols(id),
  unique (schedule_id, rule_revision, local_date)
);

create index patrol_occurrences_guard_next_idx on public.patrol_occurrences(guard_id, scheduled_at)
  where status in ('scheduled','in_progress');
create index patrol_occurrences_status_time_idx on public.patrol_occurrences(status, scheduled_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null references public.profiles(id),
  occurrence_id uuid references public.patrol_occurrences(id),
  patrol_id uuid references public.patrols(id),
  assignment_version integer not null default 1,
  kind text not null check (kind in ('upcoming','due','missed','pending','incomplete','assigned','cancelled','test')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  read_at timestamptz,
  cancelled_at timestamptz,
  unique (occurrence_id, guard_id, kind, assignment_version)
);
create index notifications_guard_recent_idx on public.notifications(guard_id, created_at desc);
create unique index notifications_free_close_idx on public.notifications(guard_id,patrol_id,kind)
  where occurrence_id is null and patrol_id is not null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  endpoint text not null check (length(endpoint) between 1 and 2048),
  p256dh text not null,
  auth_key text not null,
  guard_id uuid not null references public.profiles(id),
  session_id uuid not null,
  confirmed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create unique index push_device_active on public.push_subscriptions(device_id) where revoked_at is null;
create unique index push_endpoint_active on public.push_subscriptions(endpoint) where revoked_at is null;
create index push_guard_active on public.push_subscriptions(guard_id) where revoked_at is null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id),
  status text not null default 'queued'
    check (status in ('queued','processing','accepted','failed','cancelled')),
  attempts smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  lock_until timestamptz,
  claim_token uuid,
  accepted_at timestamptz,
  provider_status integer,
  unique (notification_id, subscription_id)
);
create index notification_delivery_queue_idx on public.notification_deliveries(status,next_attempt_at,lock_until)
  where status in ('queued','processing');

do $$
declare table_name text;
begin
  foreach table_name in array array['patrol_schedules','patrol_occurrences','notifications','push_subscriptions','notification_deliveries'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
  end loop;
end $$;

-- For repeated local times choose the earliest valid instant. A skipped local
-- time returns NULL and is reported in the agenda for manual correction.
create function public.patrol_local_instant(p_local timestamp, p_zone text)
returns timestamptz language sql stable set search_path = '' as $$
  select min(candidate)
  from (
    select (p_local - (wall - ((wall at time zone p_zone) at time zone 'UTC'))) at time zone 'UTC' as candidate
    from (values (p_local - interval '1 day'), (p_local + interval '1 day')) as probes(wall)
  ) matches
  where candidate at time zone p_zone = p_local;
$$;

create function public.valid_patrol_assignee(p_guard uuid, p_gate uuid, p_template uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.gate_assignments ga
    join public.profiles p on p.id = ga.profile_id and p.role = 'guard'
      and p.active and not p.must_change_password
    join public.gates g on g.id = ga.gate_id and g.active
    join public.sites s on s.id = g.site_id and s.active
    join public.patrol_templates t on t.gate_id = g.id and t.id = p_template and t.active
    where ga.profile_id = p_guard and ga.gate_id = p_gate and ga.active
  );
$$;

create function public.generate_patrol_occurrences(p_now timestamptz)
returns void language plpgsql set search_path = '' as $$
declare slot record;
declare issue text;
begin
  perform pg_advisory_xact_lock(667102);
  for slot in
    select r.*, d.day, public.patrol_local_instant(d.day + r.local_time, r.timezone) as at_time
    from public.patrol_schedules r
    cross join lateral (
      select (p_now at time zone r.timezone)::date + offset_day as day
      from generate_series(0,6) offset_day
    ) d
    where r.active and d.day >= r.starts_on and (r.ends_on is null or d.day <= r.ends_on)
      and extract(isodow from d.day) = any(r.weekdays)
      and not exists (select 1 from public.patrol_occurrences o
        where o.schedule_id = r.id and o.local_date = d.day
          and (o.rule_revision = r.revision or o.status in ('in_progress','completed','incomplete','missed')))
    order by at_time nulls last, r.id
  loop
    if slot.at_time is not null and slot.at_time + make_interval(mins => slot.start_grace_minutes) <= p_now then
      continue;
    end if;
    issue := case
      when slot.at_time is null then 'local_time_unavailable'
      when not public.valid_patrol_assignee(slot.guard_id, slot.gate_id, slot.template_id) then 'assignee_unavailable'
      when exists (
        select 1 from public.patrol_occurrences o where o.guard_id = slot.guard_id
          and o.status in ('scheduled','in_progress')
          and o.remind_at < slot.at_time + make_interval(mins => slot.finish_minutes)
          and o.finish_by > slot.at_time - make_interval(mins => slot.advance_minutes)
      ) then 'overlap'
    end;
    -- Preserve a visible agenda entry even when the specified wall time was skipped.
    slot.at_time := coalesce(slot.at_time, (slot.day + slot.local_time) at time zone slot.timezone);
    insert into public.patrol_occurrences
      (schedule_id,rule_revision,gate_id,template_id,guard_id,timezone,local_date,scheduled_at,
       remind_at,start_until,finish_by,notify_at_start,status,assignment_issue)
    values (slot.id,slot.revision,slot.gate_id,slot.template_id,
      case when issue is null then slot.guard_id end,slot.timezone,slot.day,slot.at_time,
      slot.at_time - make_interval(mins => slot.advance_minutes),
      slot.at_time + make_interval(mins => slot.start_grace_minutes),
      slot.at_time + make_interval(mins => slot.finish_minutes),slot.notify_at_start,
      case when issue is null then 'scheduled' else 'unassigned' end,issue);
  end loop;
end $$;

create function public.invalidate_patrol_notices(p_occurrence uuid, p_now timestamptz)
returns void language sql set search_path = '' as $$
  update public.notifications set cancelled_at = p_now
  where occurrence_id = p_occurrence and cancelled_at is null
    and kind in ('upcoming','due','pending','assigned');
$$;

create function public.save_patrol_schedule(p_actor uuid, p_id uuid, p_values jsonb, p_active boolean)
returns uuid language plpgsql set search_path = '' as $$
declare cfg public.patrol_schedules%rowtype;
declare old_cfg public.patrol_schedules%rowtype;
declare entry uuid;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin' and active and not must_change_password)
    then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(667102);
  if p_id is not null then
    select * into old_cfg from public.patrol_schedules where id = p_id for update;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
  end if;
  if p_values is not null then
    cfg := jsonb_populate_record(null::public.patrol_schedules, p_values);
    select s.timezone into cfg.timezone from public.gates g
      join public.sites s on s.id = g.site_id where g.id = cfg.gate_id;
    if not public.valid_patrol_assignee(cfg.guard_id,cfg.gate_id,cfg.template_id)
      then raise exception 'ASSIGNMENT_INVALID'; end if;
  elsif p_id is not null then
    cfg := old_cfg;
    if p_active and not public.valid_patrol_assignee(cfg.guard_id,cfg.gate_id,cfg.template_id)
      then raise exception 'ASSIGNMENT_INVALID'; end if;
    if cfg.active = p_active then return p_id; end if;
  else
    raise exception 'SCHEDULE_NOT_FOUND';
  end if;

  if p_id is null then
    insert into public.patrol_schedules
      (gate_id,template_id,guard_id,weekdays,local_time,timezone,starts_on,ends_on,advance_minutes,start_grace_minutes,finish_minutes,notify_at_start,active)
    values (cfg.gate_id,cfg.template_id,cfg.guard_id,cfg.weekdays,cfg.local_time,cfg.timezone,cfg.starts_on,cfg.ends_on,
      cfg.advance_minutes,cfg.start_grace_minutes,cfg.finish_minutes,cfg.notify_at_start,p_active) returning id into p_id;
  else
    update public.patrol_schedules set gate_id=cfg.gate_id, template_id=cfg.template_id, guard_id=cfg.guard_id,
      weekdays=cfg.weekdays, local_time=cfg.local_time, timezone=cfg.timezone, starts_on=cfg.starts_on, ends_on=cfg.ends_on,
      advance_minutes=cfg.advance_minutes, start_grace_minutes=cfg.start_grace_minutes, finish_minutes=cfg.finish_minutes,
      notify_at_start=cfg.notify_at_start, active=p_active, revision=revision+1 where id=p_id;
    for entry in update public.patrol_occurrences set status='cancelled'
      where schedule_id=p_id and status in ('scheduled','unassigned') and start_until > now()
      returning id
    loop
      perform public.invalidate_patrol_notices(entry, now());
    end loop;
  end if;
  perform public.generate_patrol_occurrences(now());
  insert into public.audit_events(actor_id,action,entity_type,entity_id)
    values(p_actor,'patrol_schedule.saved','patrol_schedule',p_id);
  return p_id;
end $$;

create function public.change_patrol_occurrence(p_actor uuid,p_id uuid,p_guard uuid,p_cancel boolean)
returns void language plpgsql set search_path = '' as $$
declare o public.patrol_occurrences%rowtype;
begin
  if not exists (select 1 from public.profiles where id=p_actor and role='admin' and active and not must_change_password)
    then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(667102);
  select * into o from public.patrol_occurrences where id=p_id for update;
  if not found or o.status not in ('scheduled','unassigned') or o.start_until <= now()
    then raise exception 'OCCURRENCE_UNAVAILABLE'; end if;
  if not p_cancel then
    if o.assignment_issue = 'local_time_unavailable' or not public.valid_patrol_assignee(p_guard,o.gate_id,o.template_id)
      then raise exception 'ASSIGNMENT_INVALID'; end if;
    if o.guard_id = p_guard then return; end if;
    if exists (select 1 from public.patrol_occurrences other where other.id<>p_id and other.guard_id=p_guard
       and other.status in ('scheduled','in_progress') and other.remind_at<o.finish_by and other.finish_by>o.remind_at)
      then raise exception 'ASSIGNMENT_OVERLAP'; end if;
  end if;
  perform public.invalidate_patrol_notices(p_id, now());
  if o.guard_id is not null and o.remind_at <= now() then
    insert into public.notifications(guard_id,occurrence_id,kind,assignment_version,expires_at)
      values(o.guard_id,p_id,'cancelled',o.assignment_version,now()+interval '30 days') on conflict do nothing;
  end if;
  update public.patrol_occurrences set status=case when p_cancel then 'cancelled' else 'scheduled' end,
    guard_id=case when p_cancel then o.guard_id else p_guard end,
    assignment_issue=null, assignment_version=o.assignment_version+1 where id=p_id;
  if not p_cancel and o.remind_at <= now() then
    insert into public.notifications(guard_id,occurrence_id,kind,assignment_version,expires_at)
      values(p_guard,p_id,'assigned',o.assignment_version+1,o.start_until) on conflict do nothing;
  end if;
  insert into public.audit_events(actor_id,action,entity_type,entity_id)
    values(p_actor,case when p_cancel then 'patrol_occurrence.cancelled' else 'patrol_occurrence.reassigned' end,'patrol_occurrence',p_id);
end $$;

create function public.start_scheduled_patrol(p_actor uuid, p_occurrence uuid)
returns uuid language plpgsql set search_path = '' as $$
declare o public.patrol_occurrences%rowtype;
declare current_shift public.shifts%rowtype;
declare patrol uuid;
begin
  perform pg_advisory_xact_lock(667102);
  select * into o from public.patrol_occurrences where id=p_occurrence and guard_id=p_actor for update;
  if not found or not public.valid_patrol_assignee(p_actor,o.gate_id,o.template_id)
    then raise exception 'OCCURRENCE_UNAVAILABLE'; end if;
  if o.status='in_progress' and o.patrol_id is not null then return o.patrol_id; end if;
  if o.status <> 'scheduled' or now() < o.remind_at or now() >= o.start_until
    then raise exception 'OCCURRENCE_UNAVAILABLE'; end if;
  select * into current_shift from public.shifts where guard_id=p_actor and ended_at is null for update;
  if not found then
    current_shift.id := public.open_guard_shift(p_actor,o.gate_id);
  elsif current_shift.gate_id <> o.gate_id then
    raise exception 'WRONG_ACTIVE_GATE';
  end if;
  if exists (select 1 from public.patrols where shift_id=current_shift.id and status='in_progress')
    then raise exception 'PATROL_ALREADY_OPEN'; end if;
  patrol := public.start_patrol_with_snapshot(current_shift.id,o.template_id,p_actor);
  update public.patrol_occurrences set status='in_progress', patrol_id=patrol where id=o.id;
  perform public.invalidate_patrol_notices(o.id,now());
  return patrol;
end $$;

create function public.sync_scheduled_patrol_close()
returns trigger language plpgsql set search_path = '' as $$
declare o public.patrol_occurrences%rowtype;
begin
  if new.status not in ('completed','incomplete') or new.status=old.status then return null; end if;
  update public.patrol_occurrences set status=new.status where patrol_id=new.id returning * into o;
  if o.id is not null then perform public.invalidate_patrol_notices(o.id,now()); end if;
  if new.status='incomplete' then
    insert into public.notifications(guard_id,occurrence_id,patrol_id,assignment_version,kind,expires_at)
      values(new.guard_id,o.id,new.id,coalesce(o.assignment_version,1),'incomplete',now()+interval '30 days') on conflict do nothing;
  end if;
  return null;
end $$;

create trigger sync_scheduled_patrol_close after update of status on public.patrols
  for each row execute function public.sync_scheduled_patrol_close();

create function public.record_scheduled_visit(p_actor uuid,p_patrol uuid,p_code text,p_key uuid,p_geo jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.patrol_occurrences where patrol_id=p_patrol and guard_id=p_actor)
    then raise exception 'PATROL_CHANGED'; end if;
  result := public.record_visit(p_actor,p_code,p_key,p_geo);
  if (result->>'patrol_id')::uuid is distinct from p_patrol
    then raise exception 'PATROL_CHANGED'; end if;
  return result;
end $$;

revoke all on function public.patrol_local_instant(timestamp,text), public.valid_patrol_assignee(uuid,uuid,uuid),
  public.generate_patrol_occurrences(timestamptz), public.invalidate_patrol_notices(uuid,timestamptz),
  public.save_patrol_schedule(uuid,uuid,jsonb,boolean), public.change_patrol_occurrence(uuid,uuid,uuid,boolean),
  public.start_scheduled_patrol(uuid,uuid), public.sync_scheduled_patrol_close(),
  public.record_scheduled_visit(uuid,uuid,text,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.patrol_local_instant(timestamp,text), public.valid_patrol_assignee(uuid,uuid,uuid),
  public.generate_patrol_occurrences(timestamptz), public.invalidate_patrol_notices(uuid,timestamptz),
  public.save_patrol_schedule(uuid,uuid,jsonb,boolean), public.change_patrol_occurrence(uuid,uuid,uuid,boolean),
  public.start_scheduled_patrol(uuid,uuid), public.record_scheduled_visit(uuid,uuid,text,uuid,jsonb) to service_role;
