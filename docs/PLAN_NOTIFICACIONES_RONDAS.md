# Plan de programación y notificaciones de rondas

Propuesta para revisión · 24 de noviembre de 2026 · Base `develop` en `da672ac`.

**Implementación confirmada.** El [procedimiento operativo](./OPERACION_NOTIFICACIONES_RONDAS.md) describe la configuración y las pruebas físicas pendientes del piloto.

## 1. Punto de partida

- La PWA ya se puede instalar y su service worker ofrece una pantalla pública sin conexión. Aún carece de suscripciones, recepción de Push y manejo del toque sobre una notificación.
- Las garitas, asignaciones, turnos y plantillas ya existen. El turno puede abrirse con el primer escaneo y una plantilla es un recorrido, no un horario. Un turno abierto no basta para decidir quién debe hacer una ronda futura.
- Las rondas iniciadas ya distinguen `in_progress`, `completed` e `incomplete`. Hoy no hay un objeto que represente una ronda esperada a una hora concreta. La frecuencia obligatoria sigue sin definirse.
- Los teléfonos se comparten y las cuentas son personales. Cada alerta necesita un destinatario explícito y un vínculo con el dispositivo y la sesión que la habilitaron.

Referencias del código: `public/sw.js`, `src/components/shared/pwa-support.tsx`, `src/app/manifest.ts`, `src/app/api/guard/prepare/route.ts` y `supabase/migrations/20261110000000_initial_schema.sql`.

## 2. MVP y reglas operativas

### Programar y asignar

1. En **Admin → Rondas → Programación**, el administrador elige sede, garita, plantilla, días de la semana, hora local, vigencia y guardia responsable. Puede pausar una regla, cancelar una ocurrencia futura o reasignarla al relevo. Solo aparecen guardias activos asignados a esa garita. Reutilizar el alcance por garita si se habilita consulta de supervisor; dejar la edición en el rol admin para el piloto.
2. El sistema genera las ocurrencias de los próximos siete días. Cada una conserva hora prevista, responsable y referencia a la plantilla, independientemente de que el guardia haya abierto turno. Si falta un responsable válido, la entrada aparece como **Sin asignar** en el panel y queda pendiente de resolución por operaciones. Evitar solapar dos rondas programadas del mismo guardia. Permitir recorridos distintos en días u horas distintos.
3. El horario es local a la sede, con zona horaria IANA. Los instantes efectivos se guardan en UTC. Mostrar una vista previa de fechas y horas antes de confirmar. Si un cambio de hora vuelve inexistente una hora local, marcarla para revisión en el calendario. Si se repite, usar la primera aparición. Conservar el histórico al editar la regla, regenerar únicamente las ocurrencias futuras que aún no empezaron y cancelar sus envíos obsoletos.
4. Valores iniciales editables para el piloto: aviso **10 minutos antes**, margen de inicio **15 minutos después** y plazo para terminar **30 minutos después** de la hora prevista. Son parámetros de prueba. Operaciones define las horas, frecuencia, duración y responsables reales antes de activar cada garita.

### Iniciar y cerrar desde el flujo actual

- En el inicio, el guardia ve **Próxima ronda** con hora, garita y recorrido. Dentro de la ventana de inicio, puede entrar a **Escanear QR** desde la tarjeta o desde la notificación. Abrir el aviso lleva a la pantalla autenticada de la ronda y no inicia un turno ni una visita por sí solo.
- La ruta programada reutiliza preparación, GPS y registro existentes. Al elegir **Escanear QR**, verificar en servidor que la ocurrencia sigue asignada al guardia, que su garita y plantilla son válidas y que no hay un turno incompatible ni otra ronda en curso. Vincular la ocurrencia y la ronda operativa atómicamente. Un reintento devuelve la misma ronda.
- Si el guardia entra por el escáner habitual y hay una ocurrencia elegible, resolverla antes de iniciar una ronda nueva. Con una coincidencia inequívoca, mostrar a qué ronda se asociará. Si hay varias opciones, pedir elección. Las rondas libres quedan disponibles según las reglas vigentes y nunca se usan para marcar una programada como completada por simple cercanía horaria.
- Marcar **No iniciada** cuando vence el margen sin ronda asociada. Si una ronda ya está en curso al vencer su plazo de cierre, conservarla abierta y mostrar **Con puntos pendientes** cuando corresponda. Si se cierra con puntos obligatorios faltantes, registrar **Incompleta** con el motivo que ya pide la app. Una ronda completada tarde sigue siendo **Completada** y conserva sus horas reales para distinguir la puntualidad.

### Avisos recomendados

| Evento | Cuándo | Destinatario y canal |
| --- | --- | --- |
| Próxima ronda | Al entrar en la anticipación configurada, si sigue pendiente | Guardia asignado · Push + bandeja |
| Hora de iniciar | A la hora prevista, si aún no inició y el recordatorio está habilitado en la regla | Guardia asignado · Push + bandeja |
| Ronda sin iniciar | Al vencer el margen, si no hay ronda asociada | Guardia · bandeja. Supervisor de esa garita · resumen en panel. |
| Ronda en curso con puntos pendientes | Una vez, al vencer el plazo de cierre, si quedan puntos obligatorios | Guardia asignado · Push + bandeja |
| Ronda cerrada incompleta | Al confirmar cierre con faltantes | Guardia · bandeja. Supervisor de esa garita · panel. Push de cierre optativo después del piloto. |
| Reasignada o cancelada | Al guardar un cambio de última hora | Actualizar bandeja y cancelar avisos pendientes del responsable anterior. Si se reasigna, avisar al nuevo responsable cuando la ronda esté cerca y siga siendo accionable. |

Para comenzar, activar **Próxima ronda** y **Puntos pendientes** como Push. Dejar **Hora de iniciar** desactivado por defecto para evitar avisos demasiado seguidos. Cada evento se emite una vez por destinatario y ocurrencia, con una versión nueva cuando una reasignación genera un aviso legítimo. Un aviso caduca cuando deja de ayudar a actuar. Las confirmaciones de rondas completadas se consultan en la app.

## 3. Experiencia de usuario

- **Garita.** Mostrar la próxima ronda cerca del estado del turno, sin tapar el escáner fijo. Añadir un acceso **Avisos** con contador, lectura por fila y estados vacío y sin conexión. Abrir una alerta vencida o reasignada muestra su estado actual y la siguiente acción disponible.
- **Cuenta → Notificaciones.** Mostrar si están activas en este dispositivo. Pedir permiso únicamente al tocar **Activar notificaciones**, ofrecer **Enviar aviso de prueba** con límite de frecuencia y permitir desactivarlas. Si el permiso fue denegado, indicar dónde cambiarlo. Si el navegador no admite Push, usar la bandeja. En iPhone/iPad, guiar al usuario para añadir la PWA a inicio y abrirla desde su icono antes de pedir permiso. [WebKit sobre Web Push en iOS y iPadOS](https://webkit.org/blog/13878/).
- **Relevo.** Registrar la suscripción por instalación y sesión autenticada. Tras cerrar sesión, revocar el vínculo de ese dispositivo en servidor antes de confirmar la salida. Si entra otra cuenta en la misma instalación, invalidar el vínculo anterior aunque la nueva cuenta no active Push. Revocar también al deshabilitar la cuenta o al vencer el vínculo de la sesión. Mantener un alcance independiente para otros dispositivos autorizados del guardia.
- **Pantalla bloqueada.** Usar texto genérico, por ejemplo, «Tienes una ronda próxima». El toque vuelve a abrir o enfocar la PWA en una ruta del mismo origen que verifica sesión y propiedad de la alerta. Un mensaje que el sistema operativo ya mostró puede quedar visible después del relevo; el texto genérico limita lo que revela.

## 4. Arquitectura y cambios propuestos

```text
Panel de programación → reglas y ocurrencias en Supabase
Supabase Cron → crea eventos y filas de entrega en la base
             → pg_net solicita el despacho solo cuando hay trabajo vencido
Ruta Next.js de despacho → envía Web Push → service worker → notificación del sistema
                         → registra resultado → bandeja y métricas
```

**Tablas y permisos.** Mantener el patrón actual de acceso por servidor con permisos de tabla y funciones para `service_role` y validación de actor y garita en rutas. Diseñar las migraciones antes de cambiar la aplicación.

| Tabla propuesta | Contenido y restricciones |
| --- | --- |
| `patrol_schedules` | Garita, plantilla, días, hora local, zona, vigencia, responsable y tiempos de aviso. Cambios auditados. |
| `patrol_occurrences` | Regla, hora prevista y plazos en UTC, responsable, estado y `patrol_id` opcional y único. Una ocurrencia por regla e instante. Índice para buscar próximos horarios y vencimientos. |
| `notifications` | Destinatario, tipo, referencia a ocurrencia, versión de asignación, caducidad y lectura. Restricción única para impedir que dos ejecuciones creen el mismo aviso. |
| `push_subscriptions` | Instalación, endpoint, materiales de cifrado de la suscripción, sesión vinculada, última confirmación y revocación. Un endpoint con un solo vínculo activo. No exponer estos datos en la interfaz ni en los logs. |
| `notification_deliveries` | Aviso, suscripción, estado, intentos, arrendamiento de procesamiento, resultado y próximo intento. Un envío lógico por aviso y suscripción; índice para trabajo pendiente. |

**Programador.** Usar Supabase Cron en el proyecto existente. Ejecutar un trabajo liviano cada minuto y emitir la llamada HTTP al servidor solo cuando haya entregas procesables. Proteger el despacho con una credencial exclusiva y rotatable del trabajo, guardada en Vault para el emisor y en variables privadas de Vercel para el receptor. La ruta no acepta destinos ni destinatarios desde la solicitud. Comprobar cuotas reales antes de activar la frecuencia en producción. Vercel Hobby tiene restricciones de frecuencia que pueden ser incompatibles con avisos al minuto. [Supabase Cron](https://supabase.com/docs/guides/cron) · [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) · [Límites de Vercel Cron](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).

**Envío.** Usar Web Push con VAPID desde una ruta Node.js y una biblioteca mantenida para dicho protocolo, con `web-push` como candidata. La clave privada se queda en el servidor. Antes de enviar, volver a comprobar que la ocurrencia y la suscripción siguen vigentes. Validar endpoints HTTPS de servicios de Push admitidos, evitar redirecciones hacia destinos arbitrarios y limitar altas, avisos de prueba y tamaño de lotes. Retirar suscripciones con `404/410`; reintentar `429/5xx` con espera creciente y caducidad. Reclamar lotes de forma atómica y recuperar reclamos vencidos. Si el proveedor acepta un envío y se pierde la respuesta, puede haber reentrega: usar un identificador estable de notificación y el mismo `tag` en el dispositivo. El estado «Aceptado por el proveedor» no confirma lectura ni entrega al usuario. [Repositorio de web-push](https://github.com/web-push-libs/web-push).

**Aplicación.** Incorporar el panel administrativo, bandeja de guardia, gestión de suscripciones autenticada, ruta interna de despacho y handlers `push` y `notificationclick` al service worker existente. Mantener el comportamiento sin conexión de la PWA y la protección de fotos, QR, GPS e historial. Revisar `src/lib/guard/current.ts`, las rutas de preparar e iniciar ronda, y el cierre de sesión. No guardar datos privados de avisos en el caché público.

## 5. Tickets y criterios de aceptación

| Ticket | Implementación | Aceptación |
| --- | --- | --- |
| N-01 · Programación | Migraciones, recurrencia, fechas UTC, admin y asignación por guardia | Agenda correcta en zona local; pausas, cancelaciones y reasignaciones conservan histórico y retiran avisos obsoletos. |
| N-02 · Operación de guardia | Próxima ronda, enlace autenticado y asociación con el flujo QR | El guardia asignado puede iniciar la ronda prevista, incluso antes de abrir turno si está en ventana; un reintento no duplica; GPS sigue siendo obligatorio. |
| N-03 · Avisos y dispositivos | Bandeja, activación voluntaria, revocación al relevo y service worker | Permiso denegado conserva bandeja; al cambiar de cuenta el equipo deja de recibir avisos del guardia anterior. |
| N-04 · Cola y envío | Programador, reglas, despacho, reintentos y métricas | Sin duplicados lógicos; sin envíos tras cancelar o completar; las suscripciones vencidas se retiran. |
| N-05 · Piloto | Pruebas y guía de operación; despliegue con despacho apagado hasta configurar el piloto | Un responsable valida horarios, frecuencia y destinatarios. Android e iPhone físicos reciben el aviso con la app en segundo plano y lo abren en la pantalla correcta. |

## 6. Pruebas, métricas y puesta en marcha

- **Automatizadas.** Reloj controlado para anticipación, medianoche Guatemala, cambios de día, ventanas, vencimientos y zona con cambio de hora. SQL para concurrencia, permisos, reasignación y asociación única. Playwright para alta, permisos, bandeja y cambio de cuenta. Simular respuestas de proveedor, reintentos, cancelación concurrente y duplicación de llamadas al despacho.
- **Piloto en una garita.** Probar Chrome en Android e iPhone con PWA instalada, bloqueo de pantalla, segundo plano, permisos denegados, pérdida de red y cambio de guardia en el mismo teléfono. Usar datos ficticios y entornos separados si ya se dispone de ellos. No aprovisionar recursos de pago sin autorización. Usar una regla de piloto y perfiles de prueba aprobados si se requiere validar en el entorno existente.
- **Indicadores.** Medir p95 desde la hora prevista del aviso hasta aceptación del proveedor (meta inicial ≤ 2 minutos), entregas lógicas duplicadas (meta 0), fallos por tipo, tamaño y antigüedad de la cola, y porcentaje de guardias del piloto con un dispositivo activo. Marcar un aviso como leído al abrir su detalle o usar la acción de lectura en la bandeja. Conservar alertas de operación separadas de los indicadores de cumplimiento.
- **Despliegue y reversión.** Aplicar migraciones aditivas, desplegar con un interruptor de despacho desactivado, configurar las claves por entorno, verificar con una cuenta de prueba y activar solo la garita piloto. Si surge un problema, apagar el despacho y pausar el job. Los registros de la app y las ocurrencias quedan disponibles. La configuración real de frecuencia, responsables y horarios se acuerda con operaciones.
