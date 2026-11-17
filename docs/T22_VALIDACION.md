# T-22 · Acceso, accesibilidad y rendimiento

## Verificaciones automatizadas

| Área | Comprobación | Ejecución |
| --- | --- | --- |
| Acceso | Sin sesión: API de visitas, turnos y administración; roles guardia, supervisor y administrador; origen ajeno, tipo de contenido y cuerpo inválidos | `pnpm test:e2e`, con `E2E_PHASE2=1` y Supabase local en CI |
| Datos | La clave pública no puede consultar directamente perfiles, visitas, auditoría ni configuración. La suite SQL también verifica permisos de tablas, QR, duplicados e idempotencia. | `tests/e2e/t22-access.spec.ts` y `supabase/tests/` en CI |
| Accesibilidad | Reglas automáticas WCAG 2.0/2.1 A/AA en login, instalación, inicio del guardia, inicio admin e historial; foco con teclado y ancho móvil | `tests/e2e/t22-accessibility.spec.ts` en Chromium de escritorio y móvil |
| Registro | Cada respuesta de `POST /api/visits` lleva `Server-Timing`, `X-Request-Id` y `Cache-Control: no-store`; el servidor escribe estado, resultado y duración sin QR, IP, ubicación ni identidad. | `tests/e2e/phase3_t12.spec.ts` y `tests/e2e/t22-access.spec.ts` |

Playwright usa un puerto propio para evitar conectarse por accidente a otra aplicación local. Para ejecutarlo en un puerto libre: `$env:E2E_PORT='3101'; pnpm test:e2e`. Sin `E2E_PHASE2`, las pruebas que requieren usuarios ficticios y Supabase local se omiten.

## Línea base sintética pública

Ejecutar `pnpm perf:audit [URL] [repeticiones]` contra una versión desplegada. El script visita `/login` y `/install` en Chromium de escritorio y Pixel 7 emulado, bloquea el service worker y entrega LCP, CLS, TTFB, carga y bytes transferidos en JSON. No visita pantallas privadas ni mide INP. Para comparar cambios, conservar URL, dispositivo, red y número de repeticiones.

Muestra inicial de producción del 17 de noviembre de 2026, tres cargas por ruta y dispositivo:

| Ruta | Dispositivo | LCP observado | CLS |
| --- | --- | --- | --- |
| `/login` | Escritorio | 708–3884 ms | 0 |
| `/install` | Escritorio | 728–2584 ms | 0 |
| `/login` | Móvil emulado | 536–728 ms | 0 |
| `/install` | Móvil emulado | 516–1036 ms | 0 |

La variación en escritorio y el tamaño de la muestra impiden afirmar que se cumpla el umbral de LCP en campo. Revisar percentil 75 de LCP, INP y CLS con datos reales cuando haya tráfico suficiente. Para el guardado, agrupar los eventos `visit.save` de los logs de Vercel por `status` y `outcome`, y calcular p50/p90 de `duration_ms`; correlacionar un fallo con `X-Request-Id`. La duración mide el trabajo del servidor, no el tiempo desde que el guardia toca el botón hasta ver la confirmación.

## Revisión antes de ampliar el piloto

- [x] Escáner importado dinámicamente; lista admin paginada; fotos comprimidas y limitadas; caché PWA solo pública (ver pruebas de T-21).
- [x] Pruebas automatizadas de roles, API, permisos de tablas, accesibilidad básica y duplicados en CI.
- [x] Medición sintética pública repetible y tiempo de API observable.
- [ ] Android Chrome e iPhone Safari físicos: cámara, GPS, linterna, teclado virtual, lector de pantalla, instalación, cambio de guardia y red intermitente (usar `docs/T21_PWA_VALIDACION.md`).
- [ ] Contraste y tamaño táctil revisados manualmente en todos los estados, incluidos modales y errores.
- [ ] LCP/INP/CLS p75 en campo; p50/p90 de guardado y tasas de error con una semana representativa.
- [ ] `EXPLAIN ANALYZE` de consultas principales con un volumen representativo y prueba de restauración de backup.
- [ ] Prueba operativa de QR dañados, poca luz, turno nocturno, fotos grandes y conexión inestable.

Estos pendientes necesitan dispositivos o datos operativos reales; las pruebas automatizadas no pueden cerrarlos por sí solas. La asignación definitiva de los doce QR a las plantas sigue pendiente de la información del usuario.
