# T-21 · Validación de instalación y conexión

Esta prueba requiere teléfonos reales y el dominio HTTPS de producción. Las pruebas automatizadas de Chromium verifican manifiesto, iconos, registro del service worker, caché pública y navegación sin red; no sustituyen la cámara ni Safari reales.

## Android · Chrome

1. Abrir `/login` en Chrome y entrar en `/install` desde el enlace visible.
2. Usar menú `⋮` → «Instalar app» o «Añadir a pantalla de inicio».
3. Abrir el icono K66 Rondas desde inicio. Debe abrir sin barra del navegador y mostrar login si no hay sesión.
4. Entrar con una cuenta de guardia, abrir «Escanear QR», conceder cámara y GPS; registrar un QR piloto. Verificar confirmación e historial.
5. Cerrar la app, volver a abrirla desde el icono y comprobar que el estado de sesión sea el esperado.
6. Sin un registro pendiente, activar modo avión. La app debe mostrar aviso de falta de conexión; «Escanear QR» queda deshabilitado. Al recargar, aparece la pantalla pública «Sin conexión».
7. Recuperar red, reabrir la app y escanear el QR. Confirmar una sola visita en historial y panel admin.

## iPhone · Safari

1. Abrir `/login` en Safari y entrar en `/install`.
2. Tocar Compartir → «Agregar a pantalla de inicio» → Agregar.
3. Abrir K66 Rondas desde el icono; entrar con la cuenta personal y verificar cámara, foco, QR y permiso de ubicación.
4. Repetir la pérdida y recuperación de señal. Nunca debe mostrarse «Punto registrado» sin una respuesta del servidor.
5. Cerrar sesión al terminar y entrar con otra cuenta en el mismo teléfono; el historial debe corresponder solo a la cuenta actual.

## Revisión de datos y seguridad

- En Chrome DevTools → Application → Cache Storage, `k66-public-shell-*` debe contener únicamente `/offline.html`, `/icon-192.png` y `/icon-512.png`.
- No deben aparecer páginas `/app`, `/admin`, `/api`, fotos, códigos QR ni respuestas con datos personales en Cache Storage.
- Un QR abierto con la cámara nativa sin red debe mostrar la pantalla pública y no crear una visita.
- Registrar modelo de teléfono, sistema, versión de navegador, fecha, resultado y captura de cualquier fallo antes de cerrar el ticket en planta.

| Dispositivo | Navegador | Instalación | Cámara/QR | Sin red | Recuperación | Resultado |
| --- | --- | --- | --- | --- | --- | --- |
| Android pendiente | Chrome | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| iPhone pendiente | Safari | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
