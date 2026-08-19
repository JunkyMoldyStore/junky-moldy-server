# Changelog

## [Unreleased]

### Security

- El backend migra del SDK legado de Mercado Pago 1.x al SDK oficial 3.4.0. Se eliminan las dependencias transitivas vulnerables del cliente anterior y las preferencias y consultas de pago usan `MercadoPagoConfig`, `Preference` y `Payment`.
- Se incorpora `package-lock.json` para que Render instale exactamente las versiones auditadas en lugar de resolver versiones distintas en cada despliegue.

- El backend restringe CORS a los orígenes publicados, la vista previa del CMS y entornos locales/LAN; se pueden agregar dominios futuros mediante `ALLOWED_ORIGINS` sin incluir secretos.
- Las solicitudes JSON se limitan a 100 KB y los errores de origen, tamaño o formato se responden de forma controlada.
- Se documentó como requisito antes de producción que los precios y el stock deben validarse contra el CMS al integrar la web pública definitiva; el carrito histórico aún los envía desde el navegador.

### Fixed

- El checkout de prueba autoriza explícitamente el origen de la vista previa pública de Cloudflare; así puede crear una preferencia de Mercado Pago sin ampliar CORS a dominios desconocidos.
- La validación manual de Webhooks acepta `ts` y `v1` en cualquier orden, obtiene el ID desde query o body, exige el manifiesto completo `id;request-id;ts` y valida el HMAC hexadecimal con comparación de tiempo constante; la sincronización de respaldo por retorno permanece intacta.
- Las preferencias de prueba ya no fuerzan una `notification_url` propia: usan el Webhook global firmado de la aplicación aislada `Junky Moldy Pruebas`, cuya simulación oficial validó con `200`. Producción no cambia.
- El diagnóstico temporal de Webhooks de prueba ahora registra el manifiesto HMAC exacto y el indicador `live_mode` recibido, sin mostrar secretos ni el cuerpo completo; permite comparar un único evento rechazado con el soporte oficial de Mercado Pago.
- El diagnóstico temporal incluye una huella SHA-256 truncada de la clave que Render cargó, para comprobar de forma segura que coincide con la clave configurada en Mercado Pago sin mostrarla ni transmitirla.
- Se agregó diagnóstico temporal de firmas inválidas, habilitado únicamente con `PAYMENT_MODE=test` y `WEBHOOK_DIAGNOSTICS=true`, que registra encabezados y URL técnicos recibidos sin exponer secretos, credenciales, cuerpo del pedido ni datos personales; producción no cambia.
- Las preferencias de prueba agregan `source_news=webhooks` a `notification_url` para que Mercado Pago envíe Webhooks firmados en lugar de notificaciones IPN; producción no cambia.
- En `PAYMENT_MODE=test`, la validación manual de Webhooks replica el validador oficial actual de Node: conserva exactamente `data.id`, normaliza las claves de `x-signature`, omite campos ausentes del manifiesto y mantiene la comparación HMAC-SHA256 en tiempo constante. Producción conserva su comportamiento anterior.
- Las preferencias creadas con `PAYMENT_MODE=test` requieren `PUBLIC_BASE_URL` e incluyen `notification_url` apuntando a `${PUBLIC_BASE_URL}/webhook?source_news=webhooks`; las preferencias de producción continúan usando exclusivamente la URL configurada en Mercado Pago.
- La validación de firmas de Webhooks ahora omite `request-id` del manifiesto HMAC cuando Mercado Pago no envía ese encabezado, según el comportamiento del SDK oficial. Esto evita rechazar con 401 pagos legítimos de Checkout Pro en modo prueba, sin aceptar firmas inválidas.
- Cuando se elige retiro en persona, el servidor descarta dirección, ciudad y notas para que datos de un envío anterior nunca se asocien al nuevo pedido.
- La simulación oficial de Webhooks de Mercado Pago responde exitosamente sin intentar consultar su identificador ficticio `123456` como si fuera un pago real.
- El webhook de Mercado Pago ahora valida exclusivamente el `data.id` firmado en la URL y responde correctamente a comprobaciones incompletas, sin generar reintentos innecesarios.
- Se eliminan espacios accidentales al leer la firma secreta de Render y se registran únicamente indicadores técnicos seguros cuando una firma es rechazada.
- Las preferencias de producción no reemplazan la URL de Webhooks configurada en Mercado Pago; el modo de prueba define su URL por preferencia para asegurar que las notificaciones lleguen al servicio de pruebas.
- Se agregó diagnóstico seguro para confirmar si dirección y ciudad llegan desde el checkout de prueba, sin escribir datos personales en los logs.

### Changed

- Las alertas de Telegram y email incluyen teléfono y correo del comprador cuando el checkout los recibió.
- Las alertas y la sincronización de pedidos conservan la dirección indicada y las notas adicionales del checkout.
- En pruebas, el pedido se guarda como pendiente antes de abrir Mercado Pago; así dirección y ciudad no dependen de la memoria temporal de Render ni del contenido parcial del webhook.

### Added

- Avisos opcionales de pagos aprobados por Telegram y correo, configurados exclusivamente mediante secretos de Render.
- Diagnosticos seguros de webhook y sincronizacion de respaldo al volver desde un pago de prueba aprobado.
- En pruebas, se conserva el pedido temporalmente durante el checkout para sincronizar el retorno aprobado sin depender de una consulta a Mercado Pago.
- Modo aislado de pruebas de Mercado Pago mediante `PAYMENT_MODE=test`.
- Página de resultado de prueba y URL de notificación configurable para validar webhooks.

### Changed

- Los pagos de prueba no se envían a la planilla de pedidos de producción y se identifican con el prefijo `TEST-`.
