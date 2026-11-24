-- Session lookup is deliberately confined to this function.
create function public.push_session_valid(p_session uuid, p_guard uuid, p_now timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join public.profiles p on p.id=s.user_id
    where s.id=p_session and s.user_id=p_guard and (s.not_after is null or s.not_after>p_now)
      and p.active and not p.must_change_password and p.role='guard'
  );
$$;

create function public.register_push_device(p_device uuid,p_guard uuid,p_session uuid,p_endpoint text,p_key text,p_auth text)
returns void language plpgsql set search_path='' as $$
begin
  if not public.push_session_valid(p_session,p_guard,now()) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(667103);
  update public.push_subscriptions set expires_at=now()+interval '30 days'
    where device_id=p_device and guard_id=p_guard and session_id=p_session and endpoint=p_endpoint
      and p256dh=p_key and auth_key=p_auth and revoked_at is null;
  if found then return; end if;
  if (select count(*) from public.push_subscriptions where guard_id=p_guard
      and device_id<>p_device and revoked_at is null and expires_at>now()) >= 5
    then raise exception 'PUSH_DEVICE_LIMIT'; end if;
  update public.push_subscriptions set revoked_at=now()
    where revoked_at is null and (device_id=p_device or endpoint=p_endpoint);
  insert into public.push_subscriptions(device_id,guard_id,session_id,endpoint,p256dh,auth_key,expires_at)
    values(p_device,p_guard,p_session,p_endpoint,p_key,p_auth,now()+interval '30 days');
end $$;

create function public.queue_test_notification(p_device uuid,p_guard uuid,p_session uuid)
returns void language plpgsql set search_path='' as $$
declare subscription uuid;
declare notice uuid;
begin
  select s.id into subscription from public.push_subscriptions s
    where device_id=p_device and guard_id=p_guard and session_id=p_session and revoked_at is null
      and expires_at>now() and public.push_session_valid(s.session_id,s.guard_id,now()) for update;
  if not found then raise exception 'NO_ACTIVE_PUSH'; end if;
  if exists (select 1 from public.notification_deliveries d
    join public.notifications n on n.id=d.notification_id
    where d.subscription_id=subscription and n.kind='test' and n.created_at>now()-interval '2 minutes')
    then raise exception 'TEST_RATE_LIMIT'; end if;
  insert into public.notifications(guard_id,kind,expires_at) values(p_guard,'test',now()+interval '5 minutes')
    returning id into notice;
  insert into public.notification_deliveries(notification_id,subscription_id) values(notice,subscription);
end $$;

create function public.push_event_active(p_notice uuid,p_subscription uuid,p_now timestamptz)
returns boolean language sql stable set search_path='' as $$
  select exists (
    select 1 from public.notifications n
    join public.push_subscriptions s on s.id=p_subscription and s.guard_id=n.guard_id
    left join public.patrol_occurrences o on o.id=n.occurrence_id
    where n.id=p_notice and n.cancelled_at is null and n.expires_at>p_now
      and s.revoked_at is null and s.expires_at>p_now and public.push_session_valid(s.session_id,s.guard_id,p_now)
      and (n.kind='test' or (
        o.guard_id=n.guard_id and o.assignment_version=n.assignment_version
        and public.valid_patrol_assignee(o.guard_id,o.gate_id,o.template_id)
        and ((n.kind in ('upcoming','due','assigned') and o.status='scheduled' and o.start_until>p_now)
          or (n.kind='pending' and o.status='in_progress' and exists (
            select 1 from public.patrol_expected_points ep where ep.patrol_id=o.patrol_id and ep.required
              and not exists (select 1 from public.visits v where v.patrol_id=o.patrol_id and v.checkpoint_id=ep.checkpoint_id)
          )))
      ))
  );
$$;

create function public.refresh_patrol_notifications(p_now timestamptz)
returns integer language plpgsql set search_path='' as $$
declare waiting integer;
begin
  if not pg_try_advisory_xact_lock(667102) then return 0; end if;
  perform public.generate_patrol_occurrences(p_now);
  with invalid as (
    update public.patrol_occurrences set status='unassigned', guard_id=null, assignment_issue='assignee_unavailable',
      assignment_version=assignment_version+1 where status='scheduled'
      and not public.valid_patrol_assignee(guard_id,gate_id,template_id)
    returning id
  )
  update public.notifications n set cancelled_at=p_now from invalid
    where n.occurrence_id=invalid.id and n.cancelled_at is null;
  with missed as (
    update public.patrol_occurrences set status='missed' where status='scheduled' and start_until<=p_now
    returning id,guard_id,assignment_version
  )
  insert into public.notifications(occurrence_id,guard_id,assignment_version,kind,expires_at)
    select id,guard_id,assignment_version,'missed',p_now+interval '30 days' from missed on conflict do nothing;

  insert into public.notifications(occurrence_id,guard_id,assignment_version,kind,expires_at)
  select o.id,o.guard_id,o.assignment_version,event.kind,event.expires
  from public.patrol_occurrences o
  cross join lateral (
    select 'upcoming'::text, o.start_until
      where o.status='scheduled' and o.remind_at<=p_now and o.scheduled_at>p_now
        and not exists (select 1 from public.notifications a where a.occurrence_id=o.id
          and a.assignment_version=o.assignment_version and a.kind='assigned')
    union all
    select 'due',o.start_until
      where o.status='scheduled' and o.notify_at_start and o.scheduled_at<=p_now and o.start_until>p_now
        and not exists (select 1 from public.notifications a where a.occurrence_id=o.id
          and a.assignment_version=o.assignment_version and a.kind='assigned' and a.created_at>=o.scheduled_at)
    union all
    select 'pending',o.finish_by+interval '30 minutes'
      where o.status='in_progress' and o.finish_by<=p_now and o.finish_by+interval '30 minutes'>p_now
        and exists (select 1 from public.patrol_expected_points ep where ep.patrol_id=o.patrol_id and ep.required
           and not exists (select 1 from public.visits v where v.patrol_id=o.patrol_id and v.checkpoint_id=ep.checkpoint_id))
  ) event(kind,expires)
  where o.status in ('scheduled','in_progress') and o.guard_id is not null
  on conflict do nothing;

  -- Match only subscriptions that existed when the event was created.
  insert into public.notification_deliveries(notification_id,subscription_id,next_attempt_at)
    select n.id,s.id,p_now from public.notifications n
    join public.push_subscriptions s on s.guard_id=n.guard_id and s.confirmed_at<=n.created_at
    where n.kind in ('upcoming','due','pending','assigned') and n.expires_at>p_now and n.cancelled_at is null
      and public.push_event_active(n.id,s.id,p_now)
    on conflict do nothing;
  update public.notification_deliveries set status='cancelled',claim_token=null,lock_until=null
    where (status='queued' or (status='processing' and lock_until<=p_now))
      and not public.push_event_active(notification_id,subscription_id,p_now);
  update public.notification_deliveries set status='failed',claim_token=null,lock_until=null
    where status='processing' and attempts>=5 and lock_until<=p_now;
  select count(*) into waiting from public.notification_deliveries
    where (status='queued' and next_attempt_at<=p_now) or (status='processing' and lock_until<=p_now);
  return waiting;
end $$;

create function public.claim_push_deliveries(p_limit integer)
returns table(delivery_id uuid, token uuid) language sql set search_path='' as $$
  with work as (
    select d.id from public.notification_deliveries d
    where ((d.status='queued' and d.next_attempt_at<=now()) or (d.status='processing' and d.lock_until<=now()))
      and d.attempts<5 and public.push_event_active(d.notification_id,d.subscription_id,now())
    order by d.next_attempt_at,d.id limit least(greatest(p_limit,1),20) for update skip locked
  )
  update public.notification_deliveries d set status='processing', attempts=d.attempts+1,
    lock_until=now()+interval '90 seconds',claim_token=gen_random_uuid()
    from work where d.id=work.id returning d.id,d.claim_token;
$$;

create function public.get_claimed_push(p_id uuid,p_token uuid)
returns table(notification_id uuid, kind text, expires_at timestamptz, endpoint text, p256dh text, auth_key text)
language sql stable set search_path='' as $$
  select n.id,n.kind,n.expires_at,s.endpoint,s.p256dh,s.auth_key
    from public.notification_deliveries d join public.notifications n on n.id=d.notification_id
    join public.push_subscriptions s on s.id=d.subscription_id
    where d.id=p_id and d.status='processing' and d.claim_token=p_token and d.lock_until>now()
      and public.push_event_active(d.notification_id,d.subscription_id,now());
$$;

create function public.finish_push_delivery(p_id uuid,p_token uuid,p_result text,p_status integer,p_retry_after integer)
returns void language plpgsql set search_path='' as $$
declare d public.notification_deliveries%rowtype;
declare expires timestamptz;
declare retry_at timestamptz;
begin
  select * into d from public.notification_deliveries where id=p_id and claim_token=p_token and status='processing' for update;
  if not found then return; end if;
  select expires_at into expires from public.notifications where id=d.notification_id;
  retry_at := now()+make_interval(secs=>least(1800,greatest(coalesce(p_retry_after,0),60*power(2,greatest(d.attempts-1,0))::integer)));
  if p_result='gone' then
    update public.push_subscriptions set revoked_at=coalesce(revoked_at,now()) where id=d.subscription_id;
  end if;
  update public.notification_deliveries set provider_status=p_status,
    status=case when p_result='accepted' then 'accepted'
      when p_result='cancelled' then 'cancelled'
      when p_result='retry' and d.attempts<5 and retry_at<expires then 'queued' else 'failed' end,
    accepted_at=case when p_result='accepted' then now() else accepted_at end,
    next_attempt_at=retry_at,lock_until=null,claim_token=null where id=d.id;
end $$;

create function public.patrol_notification_metrics()
returns jsonb language sql stable set search_path='' as $$
  with recent as (
    select d.status,d.provider_status,d.accepted_at,
      case n.kind when 'upcoming' then o.remind_at when 'due' then o.scheduled_at
        when 'pending' then o.finish_by else n.created_at end as expected_at
    from public.notification_deliveries d join public.notifications n on n.id=d.notification_id
    left join public.patrol_occurrences o on o.id=n.occurrence_id
    where n.created_at>=now()-interval '7 days'
  ), waiting as (
    select count(*) as total, extract(epoch from now()-min(n.created_at))::integer as oldest_seconds
    from public.notification_deliveries d join public.notifications n on n.id=d.notification_id
    where d.status in ('queued','processing') and n.expires_at>now()
  ), coverage as (
    select count(*) as total, count(*) filter (where exists (
      select 1 from public.push_subscriptions s where s.guard_id=assigned.guard_id and s.revoked_at is null
        and s.expires_at>now() and public.push_session_valid(s.session_id,s.guard_id,now())
    )) as enabled from (select distinct guard_id from public.patrol_occurrences
      where status='scheduled' and start_until>now()) assigned
  )
  select jsonb_build_object(
    'accepted',count(*) filter (where status='accepted'),
    'failed',count(*) filter (where status='failed'),
    'ended_subscriptions',count(*) filter (where provider_status in (404,410)),
    'p95_seconds',round((percentile_cont(0.95) within group
      (order by greatest(0,extract(epoch from accepted_at-expected_at)))
      filter (where status='accepted'))::numeric)::integer,
    'queued',(select total from waiting),'oldest_seconds',(select oldest_seconds from waiting),
    'enabled_guards',(select enabled from coverage),'assigned_guards',(select total from coverage)
  ) from recent;
$$;

revoke all on function public.push_session_valid(uuid,uuid,timestamptz),public.register_push_device(uuid,uuid,uuid,text,text,text),
  public.queue_test_notification(uuid,uuid,uuid),public.push_event_active(uuid,uuid,timestamptz),
  public.refresh_patrol_notifications(timestamptz),public.claim_push_deliveries(integer),
  public.get_claimed_push(uuid,uuid),public.finish_push_delivery(uuid,uuid,text,integer,integer),
  public.patrol_notification_metrics() from public,anon,authenticated;
grant execute on function public.push_session_valid(uuid,uuid,timestamptz),public.register_push_device(uuid,uuid,uuid,text,text,text),
  public.queue_test_notification(uuid,uuid,uuid),public.push_event_active(uuid,uuid,timestamptz),
  public.refresh_patrol_notifications(timestamptz),public.claim_push_deliveries(integer),
  public.get_claimed_push(uuid,uuid),public.finish_push_delivery(uuid,uuid,text,integer,integer),
  public.patrol_notification_metrics() to service_role;
