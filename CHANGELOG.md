# Changelog

## [Unreleased]

### Fixed

- Cuando se elige retiro en persona, el servidor descarta dirección, ciudad y notas para que datos de un envío anterior nunca se asocien al nuevo pedido.
- La simulación oficial de Webhooks de Mercado Pago responde exitosamente sin intentar consultar su identificador ficticio `123456` como si fuera un pago real.
- El webhook de Mercado Pago ahora valida exclusivamente el `data.id` firmado en la URL y responde correctamente a comprobaciones incompletas, sin generar reintentos innecesarios.
- Se eliminan espacios accidentales al leer la firma secreta de Render y se registran únicamente indicadores técnicos seguros cuando una firma es rechazada.
- Las preferencias ya no reemplazan la URL de Webhooks configurada en Mercado Pago; pruebas y producción usan así la URL y firma definidas en cada entorno.
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
