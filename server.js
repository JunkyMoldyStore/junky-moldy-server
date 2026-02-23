import express from "express";
import mercadopago from "mercadopago";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

mercadopago.configure({
  access_token: "APP_USR-4932167697942108-022310-69a008ad0781871f831eec848b64fd87-3222530842"
});

app.post("/crear-preferencia", async (req, res) => {
  try {

    const items = [
  {
    title: "Producto test",
    unit_price: 100,
    quantity: 1,
    currency_id: "UYU"
  }
];

const preference = {
  items,

  back_urls: {
success: "https://google.com",
failure: "https://google.com",
pending: "https://google.com"
  },

  auto_return: "approved"
};

    const response = await mercadopago.preferences.create(preference);

    console.log("INIT POINT:", response.body.init_point);
res.json({ init_point: response.body.init_point });

} catch (error) {
  console.error("❌ ERROR MP:");
  console.error(error.message);
  console.error(error);

  res.status(500).json({
    error: "Error creando preferencia",
    detalle: error.message
  });
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor listo en puerto", PORT));
