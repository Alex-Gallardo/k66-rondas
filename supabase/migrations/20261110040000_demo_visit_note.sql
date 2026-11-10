-- Nota opcional: propiedad, ventana de 15 minutos y auditoría en una transacción.
create function public.set_visit_note(p_actor_id uuid, p_visit_id uuid, p_note text)
returns timestamptz language plpgsql set search_path = '' as $$
declare
  v_visit public.visits%rowtype;
  v_updated timestamptz;
begin
  if p_note is null or length(trim(p_note)) = 0 or length(p_note) > 1000 then
    raise exception 'INVALID_NOTE';
  end if;
  select * into v_visit from public.visits
  where id = p_visit_id and guard_id = p_actor_id for update;
  if not found then raise exception 'VISIT_NOT_FOUND'; end if;
  if v_visit.recorded_at < now() - interval '15 minutes' then
    raise exception 'NOTE_WINDOW_EXPIRED';
  end if;
  update public.visits set note = trim(p_note), note_updated_at = now()
  where id = p_visit_id returning note_updated_at into v_updated;
  insert into public.audit_events (actor_id, action, entity_type, entity_id)
  values (p_actor_id, 'visit.note_updated', 'visit', p_visit_id);
  return v_updated;
end $$;

revoke all on function public.set_visit_note(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.set_visit_note(uuid,uuid,text) to service_role;
