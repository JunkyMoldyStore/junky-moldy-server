import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: "APP_USR-1000798862852425-053021-d316602c63a5f7903f2ad9fb363bbfb5-809124760"
});

app.post("/crear-preferencia", async (req, res) => {
  try {

    const { carrito, cliente = {}, entrega } = req.body;

    if (!carrito || carrito.length === 0) {
      return res.status(400).json({ error: "Carrito vacío" });
    }

    const items = carrito.map(prod => ({
      title: prod.nombre,
      unit_price: Number(prod.precio),
      quantity: prod.cantidad,
      currency_id: "UYU"
    }));

    const preference = {
      items,

      payer: {
  name: cliente.nombre,
  phone: {
    area_code: "598",
    number: Number(cliente.telefono)
  },
  address: {
    street_name: cliente.direccion,
    city_name: cliente.ciudad
  }
},

      metadata: {
        entrega: entrega,
        nombre: cliente.nombre || "",
        telefono: cliente.telefono || "",
        direccion: cliente.direccion || "",
        ciudad: cliente.ciudad || "",
        notas: cliente.notas || ""
      },

      back_urls: {
        success: "https://junkymoldystore.github.io/junky-moldy-server/exito.html",
        failure: "https://junkymoldystore.github.io/junky-moldy-server/error.html",
        pending: "https://junkymoldystore.github.io/junky-moldy-server/pendiente.html"
      },

      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);
    await fetch("https://script.google.com/macros/s/AKfycbyczxfWkxe0rYqo4-O8GzqdIeclp5WoGGpYYWt4d6MFuek7EV63KSVB_8br9lWuOA1dzw/exec", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
body: JSON.stringify({
  cliente: cliente.nombre || "",
  telefono: cliente.telefono || "",
  direccion: cliente.direccion || "",
  ciudad: cliente.ciudad || "",
  entrega: entrega || "",
  notas: cliente.notas || "",

  productos: carrito
    .map(p => `${p.nombre} x${p.cantidad}`)
    .join(", "),

  total: carrito.reduce(
    (sum, p) => sum + (p.precio * p.cantidad),
    0
  ),

  pago_id: "",
  estado: "Pendiente"
})
});
    console.log("🧾 Compra de:", cliente.nombre);
    console.log("🚚 Entrega:", entrega);
    console.log("🔗 INIT:", response.body.init_point);

    res.json({ init_point: response.body.init_point });

  } catch (error) {
    console.error("❌ ERROR MP:", error.message);

    res.status(500).json({
      error: "Error creando preferencia",
      detalle: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor listo en puerto", PORT));
