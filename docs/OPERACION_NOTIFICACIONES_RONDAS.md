# Activación del piloto de notificaciones

La agenda, la asociación al escaneo, la bandeja y Web Push están implementados. El despacho viene apagado. Usar una garita y guardias de prueba hasta que operaciones confirme horarios, responsables y frecuencia real. Validar con los teléfonos físicos de esa garita.

## 1. Preparar el entorno

1. Usar Supabase local en CI o un entorno de prueba ya aprobado. No usar credenciales de producción en Vercel Preview. Antes de publicar la app, aplicar las dos migraciones `20261124000000_patrol_notifications.sql` y `20261124000100_notification_dispatch.sql`. Confirmar primero con `pnpm exec supabase db push --remote --dry-run --skip-vault` que el destino y las migraciones son los esperados.
2. Publicar con `PUSH_DISPATCH_ENABLED=false`. Verificar Programación, guardia asignado, bandeja y escaneo sin horario. Configurar la regla piloto con horas locales acordadas. Si solo se quiere bandeja, se puede habilitar el trabajo de Supabase sin claves de despacho.
3. Generar un par VAPID para el entorno y una credencial aleatoria exclusiva para el trabajo de agenda. En Vercel configurar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (URI de contacto, normalmente `mailto:`), y `NOTIFICATION_DISPATCH_SECRET` (32 caracteres o más). Guardar la clave privada y la credencial como secretos. La ruta de despacho solo corresponde al despliegue del entorno elegido. Vercel Preview no habilita Push en esta versión.

## 2. Activar el trabajo y probar

1. Cargar en Supabase Vault **k66_push_dispatch_url** con la URL HTTPS completa de `/api/internal/patrol-notifications` y **k66_push_dispatch_secret** con la misma credencial que en Vercel. Usar una credencial dedicada, porque `pg_net` guarda los encabezados mientras la solicitud está en cola.
2. Ejecutar en el proyecto correcto [el script de instalación del trabajo](../supabase/ops/enable_patrol_notifications.sql). El trabajo corre cada minuto, prepara agenda y bandeja y solo llama a Vercel cuando hay entregas listas. Revisar **Integrations → Cron → Job Runs** y la última ejecución; activar la bandera de Vercel y volver a desplegar cuando el piloto esté listo.
3. En Android, activar **Cuenta → Notificaciones** y pedir un aviso de prueba. En iPhone, agregar la app al inicio, abrir el icono y hacerlo desde ahí. Confirmar recepción con la app en segundo plano y el teléfono bloqueado. Abrir el aviso, comprobar que conduce a la ronda correcta y que el GPS sigue siendo obligatorio.
4. En el mismo teléfono, cerrar sesión y entrar como otro guardia. Confirmar que los avisos nuevos del anterior dejan de llegar y que el nuevo usuario puede activar los propios. Probar permiso denegado, ronda cancelada, reasignación, cierre incompleto y un caso sin conexión.
5. Verificar **Rondas → Programación → Avisos Push**. Registrar tiempo p95 de aceptación, cola y fallos. Distinguir aceptación del proveedor, aparición en el teléfono y lectura.

## 3. Pausa y recuperación

- Para detener solo Push, publicar con `PUSH_DISPATCH_ENABLED=false` y retirar de Vault la configuración de despacho. El trabajo puede seguir actualizando agenda y bandeja.
- Para detener toda la generación, pausar **k66-patrol-notifications** en Supabase Cron. Las rondas y avisos existentes conservan sus datos.
- Si el piloto no recibe avisos, verificar primero el permiso del dispositivo, si el trabajo se ejecutó, y luego cola, caducidad y resultado del proveedor. No registrar endpoints, material de cifrado ni credenciales en incidencias.
- Si cambia VAPID, se debe volver a activar la suscripción del teléfono. Si rota la credencial del despacho, actualizar ambos lados antes de reactivar.
