# Notificaciones de compras

El servidor registra el pedido en el CMS antes de intentar avisos externos. Si Telegram o correo fallan, el pedido no se pierde: queda en **Pedidos** y el error aparece solo en los logs de Render.

## Telegram (recomendado para el teléfono)

1. En Telegram, buscá `@BotFather`, enviá `/newbot` y elegí nombre y usuario para el bot.
2. Guardá el token que entrega BotFather. Es privado: no lo envíes por chat ni lo subas a GitHub.
3. Abrí una conversación con tu bot y enviále cualquier mensaje, por ejemplo `hola`.
4. En un navegador privado abrí `https://api.telegram.org/botTOKEN/getUpdates`, reemplazando `TOKEN` localmente por el token del bot. En el resultado buscá `chat` y copiá solamente el número de `id`. No compartas la URL porque contiene el token.
5. En Render, servicio que recibe los pagos, agregá secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.

## Correo (opcional)

Se usa Resend porque el servidor está en Render. Creá una cuenta en Resend y verificá tu dirección `junkymoldy@protonmail.com` o un dominio propio. En Render agregá:

- `RESEND_API_KEY`: clave privada de Resend.
- `ORDER_NOTIFICATION_EMAIL`: `junkymoldy@protonmail.com`.
- `RESEND_FROM_EMAIL`: remitente autorizado por Resend. Para pruebas puede ser el remitente indicado por Resend; para producción conviene un dominio propio verificado.

## Mercado Pago webhook

En Developers de Mercado Pago configurá el webhook en el modo correcto (**Prueba** para el servicio test, **Producción** para el servicio real):

- URL: `https://TU-SERVICIO.onrender.com/webhook`
- Evento: pagos.
- `MP_WEBHOOK_SECRET` en Render debe ser el secreto de firma entregado para ese mismo modo.

No reutilices secretos entre prueba y producción.
