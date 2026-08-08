# Prueba segura de Mercado Pago

No cambies el servicio de producción. Creá en Render un segundo Web Service desde este mismo repositorio, con nombre `junky-moldy-server-test`.

Configurá solo en ese servicio estas variables de entorno:

- `MP_ACCESS_TOKEN`: Access Token de **prueba** de Mercado Pago.
- `MP_WEBHOOK_SECRET`: secreto de webhook de Mercado Pago.
- `CMS_SYNC_URL`: `https://junky-moldy-cms.junkymoldy.workers.dev/api/integrations/mercadopago/orders`.
- `CMS_SYNC_SECRET`: el mismo valor que `RENDER_SYNC_SECRET` del Worker de Cloudflare.
- `PAYMENT_MODE`: `test`.
- `PUBLIC_BASE_URL`: URL pública del nuevo servicio de Render, por ejemplo `https://junky-moldy-server-test.onrender.com`.

La aplicación no envía pagos de prueba a la planilla de producción. Las órdenes de prueba que lleguen al CMS se identifican por una referencia que comienza con `TEST-`.

Usá una ventana incógnito e iniciá sesión solo con la cuenta de prueba **Comprador**. Nunca uses la cuenta que cobra para una compra de prueba.
