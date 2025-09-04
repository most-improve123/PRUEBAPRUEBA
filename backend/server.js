const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { jsPDF } = require('jspdf'); // Agrega esta línea
const app = express();

app.use(cors());
app.use(express.json());

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Ruta para enviar el enlace mágico (ya existe)
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

// Ruta para generar certificados (nueva)
app.post('/api/generateCertificate', (req, res) => {
  try {
    const { nombre, curso, fecha, id, hashHex } = req.body;

    // Validar que los datos requeridos estén presentes
    if (!nombre || !curso || !fecha || !id || !hashHex) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    // Crear el PDF
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "A4" });
    doc.setFont("helvetica");
    doc.setFontSize(37);
    doc.text(curso, 425, 130, { align: "center" });
    doc.setFontSize(35);
    doc.text(nombre, 425, 190, { align: "center" });
    doc.setFontSize(14);
    const text = "WeSpark certifies that you have completed our future-ready learning experience designed to build practical";
    doc.text(doc.splitTextToSize(text, 700), 80, 250);
    doc.text(`ID: ${id}`, 4, 15);
    doc.text(`Hash: ${hashHex}`, 263, 585);

    // Generar el PDF como un buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Configurar las cabezeras para descargar el archivo
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificate_${id}.pdf"`);

    // Enviar el PDF como respuesta
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).json({ error: "Error al generar el PDF" });
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
