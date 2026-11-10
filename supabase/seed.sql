-- Datos ficticios locales. Nunca ejecutar este seed en producción.
insert into public.sites (id, code, name, timezone)
values ('10000000-0000-4000-8000-000000000001', 'PLANTA-DEMO', 'Planta de demostración', 'America/Guatemala');

insert into public.gates (id, site_id, code, name) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'CENTRAL', 'Garita Central'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'ANEXA', 'Garita Anexa');

insert into public.areas (id, site_id, code, name) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'BODEGA', 'Bodega'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'PATIO', 'Patio de carga');

insert into public.checkpoints (id, area_id, code, name) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'CENT-BOD-01', 'Entrada de bodega'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'CENT-PAT-01', 'Acceso al patio');

insert into public.patrol_templates (id, gate_id, name, is_default)
values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Ronda general', true);

insert into public.template_points (template_id, checkpoint_id, position, required) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, true),
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 2, true);

insert into public.site_settings (site_id)
values ('10000000-0000-4000-8000-000000000001');
