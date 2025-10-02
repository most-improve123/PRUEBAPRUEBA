const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Ruta para enviar el magic link
app.post('/send-magic-link', async (req, res) => {
  const { email, magicLink } = req.body;
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: "levi@wespark.io", name: "WeSpark" },
        to: [{ email }],
        subject: "Tu enlace mágico para WeSpark",
        htmlContent: `
          <p>Hola,</p>
          <p>Haz clic en el siguiente enlace para iniciar sesión:</p>
          <p><a href="${magicLink}">${magicLink}</a></p>
          <p>Saludos,<br>El equipo de WeSpark</p>
        `,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Error al enviar el correo:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta para enviar el enlace del diploma
app.post('/send-diploma-link', async (req, res) => {
  const { email, diplomaLink } = req.body;
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: "levi@wespark.io", name: "WeSpark" },
        to: [{ email }],
        subject: "Tu certificado está listo en WeSpark",
        htmlContent: `
          <p>Hola,</p>
          <p>Tu certificado está listo. Haz clic en el siguiente enlace para acceder a tu panel de graduado:</p>
          <p><a href="${diplomaLink}">Ir a mi panel de graduado</a></p>
          <p>Saludos,<br>El equipo de WeSpark</p>
        `,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Error al enviar el correo del diploma:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
