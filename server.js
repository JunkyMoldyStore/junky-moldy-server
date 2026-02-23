import express from "express";
import cors from "cors";
import mercadopago from "mercadopago";

const app = express();
app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: "TU_ACCESS_TOKEN"
});

app.post("/crear-preferencia", async (req, res) => {

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

});

app.listen(3000, () => console.log("Servidor listo"));
