import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) throw new Error("Falta configurar MP_ACCESS_TOKEN en Render.");

const app = express();
app.use(cors());
app.use(express.json());

// Esta credencial vive únicamente en las variables de entorno de Render.
mercadopago.configure({ access_token: accessToken });

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

// Se completará al conectar los webhooks firmados de Mercado Pago con el CMS.
app.post("/webhook", (_req, res) => res.sendStatus(200));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Servidor listo en puerto", port));
