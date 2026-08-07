import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";
import crypto from "node:crypto";

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) throw new Error("Falta configurar MP_ACCESS_TOKEN en Render.");

const app = express();
app.use(cors());
app.use(express.json());

// Esta credencial vive únicamente en las variables de entorno de Render.
mercadopago.configure({ access_token: accessToken });

function webhookIsValid(req) {
  const signature = req.get("x-signature");
  const requestId = req.get("x-request-id") || "";
  const paymentId = String(req.query["data.id"] || req.body?.data?.id || "").toLowerCase();
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!signature || !paymentId || !secret) return false;
  const values = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
  if (!values.ts || !values.v1) return false;
  const template = `id:${paymentId};request-id:${requestId};ts:${values.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(template).digest("hex");
  const received = Buffer.from(values.v1, "hex");
  const comparison = Buffer.from(expected, "hex");
  return received.length === comparison.length && crypto.timingSafeEqual(received, comparison);
}

function paymentStatus(status) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded" || status === "charged_back") return "refunded";
  return "pending";
}

async function syncOrderToCms(payment) {
  const syncUrl = process.env.CMS_SYNC_URL;
  const syncSecret = process.env.CMS_SYNC_SECRET;
  if (!syncUrl || !syncSecret) throw new Error("Faltan CMS_SYNC_URL o CMS_SYNC_SECRET en Render.");
  const metadata = payment.metadata || {};
  const payload = {
    payment_id: String(payment.id),
    reference: metadata.pedido_id || `MP-${payment.id}`,
    payment_status: paymentStatus(payment.status),
    total_cents: Math.round(Number(payment.transaction_amount || 0) * 100),
    customer_name: metadata.nombre || payment.payer?.first_name || "Cliente Mercado Pago",
    customer_email: payment.payer?.email || "",
    customer_phone: metadata.telefono || "",
    delivery_type: String(metadata.entrega || "").toLowerCase().includes("env") ? "shipping" : "pickup",
    notes: metadata.notas || "",
  };
  const response = await fetch(syncUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "x-render-sync-secret": syncSecret },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`CMS respondió ${response.status}`);
}

app.post("/crear-preferencia", async (req, res) => {
  try {
    const { carrito, cliente = {}, entrega } = req.body;
    const pedidoId = `JM-${Date.now()}`;

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
        entrega,
        nombre: cliente.nombre || "",
        telefono: cliente.telefono || "",
        direccion: cliente.direccion || "",
        ciudad: cliente.ciudad || "",
        notas: cliente.notas || "",
      },
      back_urls: {
        success: "https://junkymoldystore.github.io/junky-moldy-server/exito.html",
        failure: "https://junkymoldystore.github.io/junky-moldy-server/error.html",
        pending: "https://junkymoldystore.github.io/junky-moldy-server/pendiente.html",
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);
    await fetch("https://script.google.com/macros/s/AKfycbybJlWQkfmxTq4hGcTOj9-zDwJDFN8vJ6DDdcrFa4xtgaFUB69MXqYoYVMQS1VVxNlhzg/exec", {
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

    res.json({ init_point: response.body.init_point });
  } catch (error) {
    console.error("Error creando preferencia:", error.message);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

app.post("/webhook", async (req, res) => {
  if (!webhookIsValid(req)) return res.sendStatus(401);
  const paymentId = req.query["data.id"] || req.body?.data?.id;
  if (req.body?.type !== "payment" || !paymentId) return res.sendStatus(200);
  try {
    const paymentResponse = await mercadopago.payment.findById(paymentId);
    await syncOrderToCms(paymentResponse.body);
    return res.sendStatus(200);
  } catch (error) {
    console.error("Error sincronizando pago:", error.message);
    return res.sendStatus(500);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Servidor listo en puerto", port));
