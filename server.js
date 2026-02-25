import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: "TU_ACCESS_TOKEN"
});

app.post("/crear-preferencia", async (req, res) => {
  try {

    const { carrito, cliente, entrega } = req.body;

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
          number: cliente.telefono
        },
        address: {
          street_name: cliente.direccion,
          city_name: cliente.ciudad
        }
      },

      metadata: {
        entrega: entrega,
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

    res.json({ init_point: response.body.init_point });

  } catch (error) {
    console.error("❌ ERROR MP:");
    console.error(error.message);

    res.status(500).json({
      error: "Error creando preferencia",
      detalle: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor listo en puerto", PORT));
