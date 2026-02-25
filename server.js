import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: "APP_USR-1000798862852425-022310-9cb4fa58b1554593f647bf25adc67eea-809124760"
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
