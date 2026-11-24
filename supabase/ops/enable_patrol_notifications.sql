-- Ejecutar explícitamente después de aplicar las migraciones.
-- Vault: k66_push_dispatch_url (URL HTTPS de la ruta interna) y
-- k66_push_dispatch_secret (credencial exclusiva del ejecutor).
-- Sin ambos valores sigue funcionando la agenda y la bandeja.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'k66-patrol-notifications',
  '* * * * *',
  $job$
    with pending as materialized (select public.refresh_patrol_notifications(now()) as total),
    config as (
      select max(decrypted_secret) filter (where name='k66_push_dispatch_url') as url,
        max(decrypted_secret) filter (where name='k66_push_dispatch_secret') as secret
      from vault.decrypted_secrets
      where name in ('k66_push_dispatch_url','k66_push_dispatch_secret')
    )
    select net.http_post(
      url := config.url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || config.secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 25000
    )
    from pending cross join config
    where pending.total>0 and config.url like 'https://%/api/internal/patrol-notifications'
      and length(config.secret)>=32;
  $job$
);
