const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { jsPDF } = require('jspdf'); // Importa jsPDF


const app = express();
app.use(cors());
app.use(express.json());

const BREVO_API_KEY = process.env.BREVO_API_KEY;


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


app.get('/generate-pdf', async (req, res) => {
  const { id, nombre, curso, fecha, hashHex } = req.query;

  try {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'A4' });

    // Cargar imagen de fondo (opcional, si la URL es accesible)
    const fondoURL = 'https://static.wixstatic.com/media/a687f1_6daa751a4aac4a418038ae37f20db004~mv2.jpg';
    try {
      const fondoResponse = await axios.get(fondoURL, { responseType: 'arraybuffer' });
      const fondoBuffer = Buffer.from(fondoResponse.data, 'binary');
      doc.addImage(fondoBuffer, 'JPEG', 0, 0, 850, 595);
    } catch (error) {
      console.error("Error al cargar la imagen de fondo:", error);
      // Si falla, continuar sin fondo
    }

    // Generar código QR (opcional)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`;
    try {
      const qrResponse = await axios.get(qrUrl, { responseType: 'arraybuffer' });
      const qrBuffer = Buffer.from(qrResponse.data, 'binary');
      doc.addImage(qrBuffer, 'PNG', 124, 460, 100, 100);
    } catch (error) {
      console.error("Error al cargar el código QR:", error);
      // Si falla, continuar sin código QR
    }

    // Agregar texto al PDF
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(37);
    doc.setTextColor(0, 0, 0);
    doc.text(`${curso}`, 425, 130, { align: 'center' });

    doc.setFontSize(35);
    doc.setTextColor(255, 255, 255);
    doc.text(`${nombre}`, 425, 190, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const text = "WeSpark certifies that you have completed our future-ready learning experience designed to build practical";
    doc.text(doc.splitTextToSize(text, 700), 80, 250);

    const text1 = "skills for real-world impact. This certificate celebrates your participation in our interactive, innovation-focused";
    doc.text(doc.splitTextToSize(text1, 700), 80, 270);
    doc.text("training. Now go out there and release your inner genius!", 260, 290);

    // Agregar fecha
    const fechaActual = new Date();
    const dia = String(fechaActual.getDate()).padStart(2, '0');
    const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
    const anio = fechaActual.getFullYear();
    const fechaFormateada = `${dia}.${mes}.${anio}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(`San Salvador, ${fechaFormateada}`, 340, 320);

    // Agregar ID y Hash
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`ID: ${id}`, 4, 15);
    doc.text(`Hash: ${hashHex}`, 263, 585);

    // Configurar los encabezados para forzar la descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificado_${id}.pdf"`);

    // Enviar el PDF como respuesta
    res.send(Buffer.from(doc.output('arraybuffer')));
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).send("Error al generar el PDF");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
