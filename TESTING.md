# Prueba segura de Mercado Pago

No cambies el servicio de producción. Creá en Render un segundo Web Service desde este mismo repositorio, con nombre `junky-moldy-server-test`.

Configurá solo en ese servicio estas variables de entorno:

- `MP_ACCESS_TOKEN`: Access Token de **prueba** de Mercado Pago.
- `MP_WEBHOOK_SECRET`: secreto de webhook de Mercado Pago.
- `CMS_SYNC_URL`: `https://junky-moldy-cms.junkymoldy.workers.dev/api/integrations/mercadopago/orders`.
- `CMS_SYNC_SECRET`: el mismo valor que `RENDER_TEST_SYNC_SECRET` del Worker de Cloudflare.
- `PAYMENT_MODE`: `test`.
- `PUBLIC_BASE_URL`: URL pública del nuevo servicio de Render, por ejemplo `https://junky-moldy-server-test.onrender.com`.

La aplicación no envía pagos de prueba a la planilla de producción. Las órdenes de prueba que lleguen al CMS se identifican por una referencia que comienza con `TEST-`.

Usá una ventana incógnito e iniciá sesión solo con la cuenta de prueba **Comprador**. Nunca uses la cuenta que cobra para una compra de prueba.

## Validación pendiente de webhook

La simulación oficial confirma que la URL puede recibir avisos, pero no sirve para validar un pago porque utiliza el ID ficticio `123456`. Antes de activar producción, hacé un pago real de **prueba** con comprador y tarjeta de prueba, y verificá en los logs de Render que aparezca `Pago sincronizado desde webhook` sin un rechazo `invalid_signature`.

No uses el simulador como evidencia de que la firma está validada. No pegues en el chat ni en el repositorio valores de `MP_WEBHOOK_SECRET`.

## Requisito antes de producción

La web histórica todavía manda precios y cantidades en el carrito del navegador. Durante la integración aprobada con la web pública definitiva, el backend debe consultar el catálogo/inventario del CMS y construir la preferencia con esos valores autoritativos. No activar ventas reales antes de completar esa integración.
