# T-23 · Despliegue y operación

## Estado verificado el 18 de noviembre de 2026

- Producción usa Vercel en `https://k66-rondas.vercel.app` y Supabase `jabzdyiaagrygcqwbzxv` (`us-east-1`). Las diez migraciones locales coinciden con las remotas según `supabase migration list --remote`.
- La sesión CLI muestra un solo proyecto Supabase en la organización. No existe todavía un proyecto remoto de staging. Las variables Preview de Vercel no se pudieron auditar porque el CLI de esta estación no tiene sesión iniciada; deben revisarse antes de usar esos despliegues con datos.
- `supabase backups list` devolvió `backups: []` y `pitr_enabled: false`. **No se ha demostrado una restauración.** No considerar la base protegida por backups hasta exportar, conservar fuera del repositorio y restaurar una copia de prueba.
- Por decisión del propietario, esta fase prepara código y procedimiento sin crear recursos que puedan generar cuota o cargos. Las tareas externas de staging y backup quedan pendientes.

## Entornos y variables

| Entorno | Web | Base | Datos |
| --- | --- | --- | --- |
| Desarrollo/CI | `localhost` | Supabase local recreado por CI | Solo ficticios |
| Staging futuro | Vercel Preview con URL estable o proyecto Vercel separado | **Proyecto Supabase nuevo y distinto** | Solo ficticios; nunca clonar producción |
| Producción | `k66-rondas.vercel.app` | `jabzdyiaagrygcqwbzxv` | Reales |

En Vercel, asignar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` y `APP_BASE_URL` por ámbito **Production** o **Preview**. La clave secreta nunca lleva `NEXT_PUBLIC_`. Las variables Preview no deben referirse al proyecto de producción. Después de cambiar variables, desplegar de nuevo: no alteran despliegues anteriores. No imprimir QR desde Preview hasta tener una URL estable de staging y comprobar su destino. Activar protección de despliegues Preview para que las cuentas ficticias no estén abiertas a visitantes.

Antes de habilitar Preview funcional, comprobar que las cuatro variables se refieran a staging, aplicar todas las migraciones al proyecto nuevo y crear solo cuentas de prueba. Mantener las variables Production apuntando al proyecto actual. El CLI de Vercel de esta estación no tiene sesión iniciada; la configuración se realiza en el dashboard por un responsable con acceso o después de `vercel login`.

## Secuencia de una entrega con migraciones

1. Crear una rama `codex/*` y una migración nueva en `supabase/migrations/`. Nunca modificar tablas remotas con el editor SQL para saltarse el historial de migraciones.
2. Revisar el SQL, especialmente `DROP`, `ALTER`, permisos y funciones con `SECURITY DEFINER`. Ejecutar CI: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, pruebas SQL y Playwright con Supabase local. Las migraciones deben conservar el acceso directo revocado para `anon` y `authenticated`.
3. Cuando exista staging, aplicar allí primero con `pnpm exec supabase db push --remote=<STAGING_REF> --dry-run`, revisar la lista y ejecutar `pnpm exec supabase db push --remote=<STAGING_REF> --yes`. Verificar `pnpm exec supabase migration list --remote=<STAGING_REF>` y probar login, escaneo ficticio, historial y panel en el Preview conectado a staging.
4. Confirmar un backup recuperable de producción antes de una migración de datos. Ejecutar `pnpm exec supabase db push --remote=jabzdyiaagrygcqwbzxv --dry-run`; revisar exactamente qué aplicará. Hacer el `db push` de producción solo una vez y por una persona, seguido de `migration list`.
5. Integrar la web, esperar el despliegue de Vercel y ejecutar `pnpm smoke:production`. Revisar los logs de errores y un registro real autorizado con teléfono. Registrar commit, migraciones, hora local, responsable y resultado en la entrega.

Hasta que staging y backup estén listos, **no ejecutar migraciones destructivas en producción**. La CI local verifica el esquema, pero no sustituye una restauración.

## Backup y recuperación

Supabase documenta backups diarios para planes Pro/Team/Enterprise y recomienda exportaciones con `supabase db dump` más copia externa para el nivel gratuito. En este proyecto la lista actual está vacía. La siguiente activación debe incluir:

1. Elegir destino privado y cifrado fuera de GitHub público; definir responsable, frecuencia diaria, retención y custodia de la clave. No guardar `.sql`, archivos de Storage ni contraseñas en este repositorio o en artifacts públicos.
2. Probar `supabase db dump --remote=jabzdyiaagrygcqwbzxv` en un equipo o runner con herramientas requeridas; exportar **esquema y datos**, incluyendo los esquemas necesarios para cuentas de Auth y metadatos de Storage. Registrar tamaño, fecha y hash SHA-256 del archivo cifrado. Confirmar que se pudo abrir y consultar el contenido en un entorno aislado.
3. Copiar por separado los **objetos** de Supabase Storage (fotografías). Un dump de Postgres o backup diario de la base solo conserva sus metadatos, no los archivos.
4. Restaurar la copia a un proyecto distinto y sin datos reales de operación; verificar usuarios de prueba, conteo de visitas, puntos QR, permisos y al menos una foto. Documentar tiempo de recuperación y pérdida máxima aceptable.

Una recuperación de producción debe decidir el instante de corte, detener nuevas rondas, preservar evidencia del incidente y restaurar primero en un proyecto aparte cuando sea posible. Restaurar directamente la base actual sustituye datos recientes y puede dejar objetos de Storage desalineados. La restauración no está autorizada ni ensayada todavía.

## Salud, logs y alertas

`GET /api/health` comprueba una lectura mínima de `sites` a través de la clave del servidor. Devuelve solo `{ "status": "ok" }` (200) o `{ "status": "degraded" }` (503), siempre con `Cache-Control: no-store`; no expone registros ni configuración. El script `pnpm smoke:production` revisa login, instalación, manifiesto, salud y rechazo anónimo de administración. No inicia sesión ni crea visitas.

`.github/workflows/production-smoke.yml` lo ejecuta cada 30 minutos y permite iniciarlo manualmente. El job rojo es la señal de alerta: habilitar en GitHub las notificaciones de fallos de Actions para quien atiende la operación. Revisar la pestaña Actions cada semana; los workflows programados de repositorios públicos pueden desactivarse tras 60 días sin actividad. Una ejecución programada puede retrasarse, así que esta señal no sustituye un servicio externo de disponibilidad si se pacta un tiempo de respuesta estricto.

Para investigar fallos, abrir logs de Functions en Vercel y filtrar `health.check` o `visit.save`. `visit.save` incluye estado, resultado y `duration_ms` sin QR, IP, GPS ni identidad. Calcular p50/p90 de duración y porcentaje de 5xx por día; el `X-Request-Id` de la respuesta permite correlacionar un intento. Si hay 503 de salud, comprobar estado de Supabase, variables Production y permisos de `sites`. Los errores de cámara y de red del dispositivo requieren una prueba en teléfono o telemetría posterior; el servidor no los ve si nunca llega una solicitud.

## Rollback

Si falla solo la web y la base sigue compatible, seleccionar el último despliegue sano en Vercel y usar **Rollback**; luego ejecutar `pnpm smoke:production`. La reversión de Vercel no revierte migraciones ni visitas ya guardadas.

Si falla una migración, detener despliegues y nuevas escrituras, conservar logs y evaluar una migración correctiva hacia adelante. Restaurar backup únicamente tras estimar la pérdida de datos y validar la copia en un proyecto aislado. Nunca usar `supabase db reset` contra un proyecto remoto. Registrar el incidente y añadir una prueba de regresión antes del siguiente despliegue.

## Pendientes de activación

- [ ] Crear y configurar Supabase de staging cuando se autorice su cuota/costo, y separar variables Preview/Production en Vercel.
- [ ] Establecer backup cifrado fuera del repositorio, incluir objetos de Storage y ensayar restauración.
- [ ] Asignar responsable de alertas y habilitar notificaciones de GitHub Actions.
- [ ] Probar rollback de Vercel y una recuperación de datos en un entorno aislado.

Fuentes operativas: [Supabase · entornos y migraciones](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase · backups](https://supabase.com/docs/guides/platform/backups), [Vercel · Preview y rollback](https://vercel.com/docs/deployments/promote-preview-to-production), [GitHub · runners y cron](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
