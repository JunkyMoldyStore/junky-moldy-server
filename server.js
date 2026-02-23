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

    const items = req.body.map(prod => ({
      title: prod.nombre,
      unit_price: prod.precio,
      quantity: prod.cantidad,
      currency_id: "ARS"
    }));

    const preference = {
      items,
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({ init_point: response.body.init_point });

  } catch (error) {
    console.error("ERROR MP:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor listo en puerto", PORT));
