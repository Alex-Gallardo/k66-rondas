begin;

do $$
declare
  v_admin uuid;
  v_guard uuid;
  v_other uuid;
  v_gate uuid := '20000000-0000-4000-8000-000000000001';
  v_template uuid := '50000000-0000-4000-8000-000000000001';
  v_local timestamp := (now()+interval '5 minutes') at time zone 'America/Guatemala';
  v_rule uuid;
  v_slot public.patrol_occurrences%rowtype;
  v_patrol uuid;
  v_device uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_subscription uuid;
  v_delivery record;
begin
  if has_table_privilege('anon','public.notifications','SELECT')
    or has_table_privilege('authenticated','public.push_subscriptions','SELECT')
    or has_function_privilege('authenticated','public.start_scheduled_patrol(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.get_claimed_push(uuid,uuid)','EXECUTE')
    then raise exception 'Las nuevas tablas y funciones deben ser privadas'; end if;
  if public.patrol_local_instant('2026-03-08 02:30','America/New_York') is not null
    or public.patrol_local_instant('2026-11-01 01:30','America/New_York') is distinct from '2026-11-01 05:30+00'::timestamptz
    or public.patrol_local_instant('2026-11-24 00:05','America/Guatemala') is distinct from '2026-11-24 06:05+00'::timestamptz
    then raise exception 'La conversión del horario local no coincide'; end if;
  select id into strict v_admin from public.profiles where employee_code='E2E-ADMIN';
  select id into strict v_guard from public.profiles where employee_code='E2E-T11-DESK';
  select id into strict v_other from public.profiles where employee_code='E2E-T11-MOB';
  v_rule := public.save_patrol_schedule(v_admin,null,jsonb_build_object(
    'gate_id',v_gate,'template_id',v_template,'guard_id',v_guard,
    'weekdays',array[extract(isodow from v_local)::integer],
    'local_time',v_local::time,'starts_on',v_local::date,'ends_on',v_local::date,
    'advance_minutes',10,'start_grace_minutes',15,'finish_minutes',30,'notify_at_start',false
  ),true);
  select * into strict v_slot from public.patrol_occurrences where schedule_id=v_rule;
  if v_slot.status<>'scheduled' or v_slot.guard_id<>v_guard then raise exception 'Ocurrencia mal asignada'; end if;

  insert into auth.sessions(id,user_id,created_at,updated_at) values(v_session,v_guard,now(),now());
  perform public.register_push_device(v_device,v_guard,v_session,'https://fcm.googleapis.com/fcm/send/test','key','auth');
  select id into strict v_subscription from public.push_subscriptions where device_id=v_device and revoked_at is null;
  perform public.refresh_patrol_notifications(now());
  perform public.refresh_patrol_notifications(now());
  if (select count(*) from public.notifications where occurrence_id=v_slot.id and kind='upcoming')<>1
    or (select count(*) from public.notification_deliveries where subscription_id=v_subscription)<>1
    then raise exception 'Los avisos y entregas deben ser idempotentes'; end if;
  select * into strict v_delivery from public.claim_push_deliveries(1);
  if (select count(*) from public.get_claimed_push(v_delivery.delivery_id,v_delivery.token))<>1
    or exists (select 1 from public.claim_push_deliveries(1))
    then raise exception 'Un reclamo activo no debe duplicarse'; end if;
  perform public.finish_push_delivery(v_delivery.delivery_id,v_delivery.token,'retry',429,90);
  if not exists (select 1 from public.notification_deliveries
    where id=v_delivery.delivery_id and status='queued' and next_attempt_at>=now()+interval '90 seconds')
    then raise exception 'El trabajador debe respetar Retry-After'; end if;

  perform public.change_patrol_occurrence(v_admin,v_slot.id,v_other,false);
  if not exists (select 1 from public.notifications where occurrence_id=v_slot.id
    and guard_id=v_guard and kind='upcoming' and cancelled_at is not null)
    or not exists (select 1 from public.notifications where occurrence_id=v_slot.id and guard_id=v_other and kind='assigned')
    then raise exception 'La reasignación dejó avisos incorrectos'; end if;
  begin
    perform public.start_scheduled_patrol(v_guard,v_slot.id);
    raise exception 'El responsable anterior pudo iniciar la ronda';
  exception when others then
    if sqlerrm<>'OCCURRENCE_UNAVAILABLE' then raise; end if;
  end;
  v_patrol := public.start_scheduled_patrol(v_other,v_slot.id);
  if public.start_scheduled_patrol(v_other,v_slot.id)<>v_patrol
    or not exists(select 1 from public.patrol_occurrences where id=v_slot.id and patrol_id=v_patrol and status='in_progress')
    then raise exception 'El reintento no mantuvo la ronda original'; end if;
  perform public.refresh_patrol_notifications(v_slot.finish_by+interval '1 minute');
  if not exists(select 1 from public.notifications where occurrence_id=v_slot.id and guard_id=v_other and kind='pending')
    then raise exception 'No se avisó de los puntos pendientes'; end if;
  perform public.close_guard_patrol(v_other,v_patrol,'Acceso de prueba cerrado');
  if not exists(select 1 from public.patrol_occurrences where id=v_slot.id and status='incomplete')
    or not exists(select 1 from public.notifications where occurrence_id=v_slot.id and kind='incomplete')
    then raise exception 'El cierre incompleto no se reflejó en la agenda'; end if;

  perform public.queue_test_notification(v_device,v_guard,v_session);
  select * into strict v_delivery from public.claim_push_deliveries(1);
  update public.push_subscriptions set revoked_at=now() where id=v_subscription;
  if exists(select 1 from public.get_claimed_push(v_delivery.delivery_id,v_delivery.token))
    then raise exception 'El despacho debe revalidar después de la revocación'; end if;
  perform public.patrol_notification_metrics();
end $$;

rollback;
