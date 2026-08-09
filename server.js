import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";
import crypto from "node:crypto";

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) throw new Error("Falta configurar MP_ACCESS_TOKEN en Render.");
const paymentMode = String(process.env.PAYMENT_MODE || "production").trim().toLowerCase();
if (!['production', 'test'].includes(paymentMode)) throw new Error('PAYMENT_MODE debe ser "production" o "test".');
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
// Solo para el circuito de prueba: conserva el pedido durante el checkout de
// prueba para poder registrar el resultado sin depender de la API de pagos.
const testOrders = new Map();

const app = express();
app.use(cors());
app.use(express.json());

// Esta credencial vive únicamente en las variables de entorno de Render.
mercadopago.configure({ access_token: accessToken });

app.get('/resultado-prueba', async (req, res) => {
  if (paymentMode !== 'test') return res.sendStatus(404);
  const state = String(req.query.estado || 'pending');
  const paymentId = req.query.payment_id || req.query.collection_id;
  const testOrderId = String(req.query.pedido || '');
  if (state === 'approved' && paymentId) {
    try {
      const preparedOrder = testOrders.get(testOrderId);
      if (preparedOrder) {
        await postOrderToCms({ ...preparedOrder, payment_id: String(paymentId), payment_status: 'approved' });
        testOrders.delete(testOrderId);
        console.log('Pago de prueba sincronizado desde retorno', { paymentId: String(paymentId), testOrderId });
      } else {
        const paymentResponse = await mercadopago.payment.findById(paymentId);
        await syncOrderToCms(paymentResponse.body);
        console.log('Pago de prueba sincronizado desde retorno', { paymentId: String(paymentId) });
      }
    } catch (error) {
      console.error('Error sincronizando pago de prueba desde retorno:', error.message);
    }
  }
  res.type('html').send(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resultado de prueba</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#11130e;color:#f1e7b1;font:18px Georgia,serif"><main style="max-width:520px;padding:32px;border:1px solid #b99a45;background:#181a13;text-align:center"><p style="color:#d8bd54;letter-spacing:.12em">JUNKY MOLDY · PRUEBA</p><h1>Pago de prueba: ${state}</h1><p>${state === 'approved' && paymentId ? 'Se intentó sincronizar este pago de prueba con el CMS. Revisá Pedidos.' : 'No se realizó ningún cobro real ni se creó un pedido de venta.'}</p></main></body></html>`);
});

function webhookIsValid(req) {
  const signature = req.get("x-signature");
  const requestId = req.get("x-request-id") || "";
  // Mercado Pago firma el identificador que llega en la URL (`data.id`).
  // No usamos el cuerpo como reemplazo: las notificaciones de comprobación
  // pueden traer un cuerpo incompleto y no representan un pago procesable.
  const paymentId = String(req.query["data.id"] || "").toLowerCase();
  // `trim()` evita que un salto de línea accidental al pegar el secreto en
  // Render invalide todas las firmas sin cambiar la clave real.
  const secret = String(process.env.MP_WEBHOOK_SECRET || "").trim();
  if (!signature || !paymentId || !secret) {
    return { valid: false, reason: 'missing_values', hasRequestId: Boolean(requestId), hasPaymentId: Boolean(paymentId) };
  }
  const values = Object.fromEntries(signature.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator === -1 ? [] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }).filter(([key, value]) => key && value));
  if (!values.ts || !values.v1) {
    return { valid: false, reason: 'incomplete_signature', hasRequestId: Boolean(requestId), hasPaymentId: Boolean(paymentId) };
  }
  const template = `id:${paymentId};request-id:${requestId};ts:${values.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(template).digest("hex");
  const received = Buffer.from(values.v1, "hex");
  const comparison = Buffer.from(expected, "hex");
  return {
    valid: received.length === comparison.length && crypto.timingSafeEqual(received, comparison),
    reason: 'invalid_signature',
    hasRequestId: Boolean(requestId),
    hasPaymentId: Boolean(paymentId),
    hasTimestamp: Boolean(values.ts),
  };
}

function paymentStatus(status) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded" || status === "charged_back") return "refunded";
  return "pending";
}

async function syncOrderToCms(payment) {
  const metadata = payment.metadata || {};
  return postOrderToCms({
    payment_id: String(payment.id),
    reference: metadata.pedido_id || `MP-${payment.id}`,
    payment_status: paymentStatus(payment.status),
    total_cents: Math.round(Number(payment.transaction_amount || 0) * 100),
    customer_name: metadata.nombre || payment.payer?.first_name || "Cliente Mercado Pago",
    customer_email: payment.payer?.email || "",
    customer_phone: metadata.telefono || "",
    shipping_address: { address: metadata.direccion || "", city: metadata.ciudad || "" },
    delivery_type: String(metadata.entrega || "").toLowerCase().includes("env") ? "shipping" : "pickup",
    notes: metadata.notas || "",
  });
}

async function postOrderToCms(payload) {
  const syncUrl = process.env.CMS_SYNC_URL;
  const syncSecret = process.env.CMS_SYNC_SECRET;
  if (!syncUrl || !syncSecret) throw new Error("Faltan CMS_SYNC_URL o CMS_SYNC_SECRET en Render.");
  const response = await fetch(syncUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-render-sync-secret": syncSecret },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`CMS respondió ${response.status}`);
  const result = await response.json().catch(() => ({}));
  if ((result.created || result.became_approved) && payload.payment_status === 'approved') await notifyApprovedOrder(payload);
  return result;
}

function orderNotificationText(payload) {
  const testLabel = String(payload.reference || '').startsWith('TEST-') ? '[PRUEBA] ' : '';
  const amount = new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format((Number(payload.total_cents) || 0) / 100);
  const address = [payload.shipping_address?.address, payload.shipping_address?.city].filter(Boolean).join(', ');
  const details = [payload.customer_phone ? `Teléfono: ${payload.customer_phone}` : '', payload.customer_email ? `Email: ${payload.customer_email}` : '', address ? `Dirección: ${address}` : '', payload.notes ? `Notas: ${payload.notes}` : ''].filter(Boolean).join('\n');
  return `${testLabel}Pago aprobado\nPedido: ${payload.reference}\nImporte: ${amount}\nEntrega: ${payload.delivery_type === 'shipping' ? 'Envio' : 'Retiro'}\nCliente: ${payload.customer_name || 'Sin nombre'}${details ? `\n${details}` : ''}\nRevisa el CMS para ver el detalle.`;
}

async function notifyApprovedOrder(payload) {
  const text = orderNotificationText(payload);
  const tasks = [];
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  if (telegramToken && telegramChatId) tasks.push(
    fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text }),
    }).then((response) => { if (!response.ok) throw new Error(`Telegram failed with ${response.status}`); }),
  );
  const resendKey = process.env.RESEND_API_KEY;
  const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;
  const resendFrom = process.env.RESEND_FROM_EMAIL;
  if (resendKey && notificationEmail && resendFrom) tasks.push(
    fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: resendFrom, to: [notificationEmail], subject: `${String(payload.reference || '').startsWith('TEST-') ? '[PRUEBA] ' : ''}Nuevo pago aprobado`, text }),
    }).then((response) => { if (!response.ok) throw new Error(`Email failed with ${response.status}`); }),
  );
  if (!tasks.length) return;
  const results = await Promise.allSettled(tasks);
  for (const result of results) if (result.status === 'rejected') console.error('No se pudo enviar una notificacion:', result.reason.message);
}

app.post("/crear-preferencia", async (req, res) => {
  try {
    const { carrito, cliente = {}, entrega } = req.body;
    const pedidoId = `${paymentMode === 'test' ? 'TEST-' : ''}JM-${Date.now()}`;
    // Diagnóstico temporal y seguro: confirma la llegada de los campos sin
    // registrar nombres, teléfonos, direcciones ni ningún otro dato privado.
    console.info('Checkout recibido', {
      pedidoId,
      delivery_type: entrega || '',
      has_address: Boolean(String(cliente.direccion || '').trim()),
      has_city: Boolean(String(cliente.ciudad || '').trim()),
      has_notes: Boolean(String(cliente.notas || '').trim()),
    });

    if (!Array.isArray(carrito) || carrito.length === 0) {
      return res.status(400).json({ error: "Carrito vacío" });
    }

    const items = carrito.map((product) => ({
      title: product.nombre,
      unit_price: Number(product.precio),
      quantity: Number(product.cantidad),
      currency_id: "UYU",
    }));

    if (items.some((item) => !item.title || !Number.isFinite(item.unit_price) || item.unit_price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return res.status(400).json({ error: "El carrito tiene datos inválidos" });
    }

    const preference = {
      items,
      payer: {
        name: cliente.nombre,
        phone: { area_code: "598", number: Number(cliente.telefono) },
        address: { street_name: cliente.direccion, city_name: cliente.ciudad },
      },
      metadata: {
        pedido_id: pedidoId,
        payment_mode: paymentMode,
        entrega,
        nombre: cliente.nombre || "",
        telefono: cliente.telefono || "",
        direccion: cliente.direccion || "",
        ciudad: cliente.ciudad || "",
        notas: cliente.notas || "",
      },
      external_reference: pedidoId,
      back_urls: paymentMode === 'test' && publicBaseUrl ? {
        success: `${publicBaseUrl}/resultado-prueba?estado=approved&pedido=${encodeURIComponent(pedidoId)}`,
        failure: `${publicBaseUrl}/resultado-prueba?estado=rejected&pedido=${encodeURIComponent(pedidoId)}`,
        pending: `${publicBaseUrl}/resultado-prueba?estado=pending&pedido=${encodeURIComponent(pedidoId)}`,
      } : {
        success: "https://junkymoldystore.github.io/junky-moldy-server/exito.html",
        failure: "https://junkymoldystore.github.io/junky-moldy-server/error.html",
        pending: "https://junkymoldystore.github.io/junky-moldy-server/pendiente.html",
      },
      auto_return: "approved",
    };

    // La URL y la firma del webhook se administran desde Mercado Pago
    // (configuración de pruebas o producción). No se fuerzan por preferencia:
    // esa prioridad puede apuntar a una configuración distinta de la que emitió
    // la Secret signature guardada en Render.

    if (paymentMode === 'test') {
      const checkoutOrder = {
        payment_id: `pending:${pedidoId}`,
        reference: pedidoId,
        payment_status: 'pending',
        total_cents: Math.round(carrito.reduce((sum, product) => sum + (Number(product.precio) * Number(product.cantidad)), 0) * 100),
        customer_name: cliente.nombre || 'Cliente de prueba',
        customer_email: cliente.email || '',
        customer_phone: cliente.telefono || '',
        shipping_address: { address: cliente.direccion || '', city: cliente.ciudad || '' },
        delivery_type: String(entrega || '').toLowerCase().includes('env') ? 'shipping' : 'pickup',
        notes: cliente.notas || '',
      };
      // Persistir antes de redirigir a Mercado Pago evita perder datos del
      // formulario si Render se reinicia o el webhook llega con datos parciales.
      const pendingSync = await postOrderToCms(checkoutOrder);
      console.info('Pedido de prueba pendiente guardado en CMS', {
        pedidoId,
        created: Boolean(pendingSync.created),
        updated: Boolean(pendingSync.updated),
        has_address: Boolean(checkoutOrder.shipping_address.address),
        has_city: Boolean(checkoutOrder.shipping_address.city),
      });
      testOrders.set(pedidoId, checkoutOrder);
    }

    const response = await mercadopago.preferences.create(preference);
    if (paymentMode === 'production') await fetch("https://script.google.com/macros/s/AKfycbybJlWQkfmxTq4hGcTOj9-zDwJDFN8vJ6DDdcrFa4xtgaFUB69MXqYoYVMQS1VVxNlhzg/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedido_id: pedidoId,
        cliente: cliente.nombre || "",
        telefono: cliente.telefono || "",
        direccion: cliente.direccion || "",
        ciudad: cliente.ciudad || "",
        entrega: entrega || "",
        notas: cliente.notas || "",
        productos: carrito.map((product) => `${product.nombre} x${product.cantidad}`).join(", "),
        total: carrito.reduce((sum, product) => sum + (Number(product.precio) * Number(product.cantidad)), 0),
        pago_id: "",
        estado: "Pendiente",
      }),
    });

    res.json({ init_point: response.body.init_point, payment_mode: paymentMode });
  } catch (error) {
    console.error("Error creando preferencia:", error.message);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

app.post("/webhook", async (req, res) => {
  const type = String(req.body?.type || req.query.type || req.query.topic || '').toLowerCase();
  // Mercado Pago puede enviar comprobaciones sin datos de pago. Se ignoran sin
  // responder error, pero un pago real siempre debe pasar la firma HMAC.
  if (type !== 'payment') return res.sendStatus(200);
  const paymentId = String(req.query["data.id"] || '');
  if (!paymentId) {
    console.info('Webhook de comprobación ignorado', { type, hasSignature: Boolean(req.get('x-signature')) });
    return res.sendStatus(200);
  }
  const verification = webhookIsValid(req);
  if (!verification.valid) {
    console.warn('Webhook rechazado', {
      reason: verification.reason,
      hasSignature: Boolean(req.get('x-signature')),
      hasRequestId: verification.hasRequestId,
      hasPaymentId: verification.hasPaymentId,
      hasTimestamp: verification.hasTimestamp,
      type,
    });
    return res.sendStatus(401);
  }
  try {
    console.log('Webhook de pago recibido', { paymentId: String(paymentId) });
    const paymentResponse = await mercadopago.payment.findById(paymentId);
    await syncOrderToCms(paymentResponse.body);
    console.log('Pago sincronizado desde webhook', { paymentId: String(paymentId) });
    return res.sendStatus(200);
  } catch (error) {
    console.error("Error sincronizando pago:", error.message);
    return res.sendStatus(500);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Servidor listo en puerto", port));
