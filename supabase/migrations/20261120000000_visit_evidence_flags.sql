-- Los indicadores permiten combinar nota y foto antes de paginar visitas.
alter table public.visits
  add column has_observation boolean generated always as
    (nullif(btrim(note), '') is not null) stored,
  add column has_photo boolean not null default false;

update public.visits v
set has_photo = exists (
  select 1 from public.visit_photos photo where photo.visit_id = v.id
);

create function public.sync_visit_photo_flag()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    update public.visits
    set has_photo = exists (
      select 1 from public.visit_photos where visit_id = old.visit_id
    )
    where id = old.visit_id;
  end if;
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    update public.visits
    set has_photo = exists (
      select 1 from public.visit_photos where visit_id = new.visit_id
    )
    where id = new.visit_id;
  end if;
  return null;
end $$;

create trigger visit_photos_sync_visit_flag
after insert or delete or update of visit_id on public.visit_photos
for each row execute function public.sync_visit_photo_flag();

revoke all on function public.sync_visit_photo_flag() from public, anon, authenticated;
