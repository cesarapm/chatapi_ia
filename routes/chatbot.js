const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Guardar datos temporales por usuario
const conversations = {};

router.get("/", async (req, res) => {
    const { userId, message } = req.body;
  
    if (!conversations[userId]) {
      conversations[userId] = { 
        etapa: "esperando_respuesta", 
        nombre: "", 
        email: "", 
        telefono: "", 
        mensaje: "" 
      };
      return res.json({ reply: "¡Hola! Soy un asistente virtual. ¿En qué puedo ayudarte hoy?" });
    }
  
    let userData = conversations[userId];
  
    switch (userData.etapa) {
      case "esperando_respuesta":
        userData.etapa = "explicacion_datos";
        return res.json({ reply: "¡Gracias por compartirlo! Para conectarte con un asesor, necesito algunos datos. Empecemos con tu nombre. ¿Cómo te llamas?" });
  
      case "explicacion_datos":
        userData.nombre = message;
        userData.etapa = "pedir_email";
        return res.json({ reply: `Encantado, ${message}. ¿Cuál es tu correo electrónico para que podamos contactarte?` });
  
      case "pedir_email":
        if (!message.includes("@") || !message.includes(".")) {
          return res.json({ reply: "El correo ingresado no es válido. Por favor, ingresa un correo con '@' y un dominio válido." });
        }
        userData.email = message;
        userData.etapa = "pedir_telefono";
        return res.json({ reply: "Perfecto. Ahora, ¿podrías darme tu número de teléfono?" });
  
      case "pedir_telefono":
        if (!/^\d{10}$/.test(message)) {
          return res.json({ reply: "El número de teléfono debe contener exactamente 10 dígitos numéricos. Inténtalo de nuevo." });
        }
        userData.telefono = message;
        userData.etapa = "pedir_mensaje";
        return res.json({ reply: "Gracias. Por último, ¿cuál es tu mensaje o consulta?" });
  
      case "pedir_mensaje":
        userData.mensaje = message;
  
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: "garyfeomm@gmail.com",
          subject: "Nuevo mensaje del chatbot",
          text: `Nombre: ${userData.nombre}\nEmail: ${userData.email}\nTeléfono: ${userData.telefono}\nMensaje: ${userData.mensaje}`,
        };
  
        try {
          await transporter.sendMail(mailOptions);
          delete conversations[userId];
          return res.json({ reply: "¡Gracias! Tu mensaje ha sido enviado. Un asesor te contactará pronto." });
        } catch (error) {
          console.log(error);
          return res.status(500).json({ reply: "Error al enviar el correo. Inténtalo más tarde." });
        }
  
      default:
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: message }],
        });
  
        return res.json({ reply: response.choices[0].message.content });
    }
});

module.exports = router;
