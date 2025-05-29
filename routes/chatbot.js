const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { OpenAI } = require("openai");

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

// Base de conocimientos corregida
const knowledgeBase = {
  servicios: "Ofrecemos diseño web, desarrollo de sistemas a medida, e-commerce, y mantenimiento de sitios.",
  precios: "Nuestros precios varían según el proyecto. ¡Contáctanos para una cotización personalizada!",
  tiempos: "El tiempo promedio de entrega depende del proyecto, pero generalmente es de 2 a 4 semanas.",
  contacto: "Puedes escribirnos aquí mismo o a nuestro correo geoapm@hotmail.com",
};

const conversations = {};

const saludos = ["hola", "buenos días", "buenas tardes", "qué tal", "hey"];
const respuestasAfirmativas = ["sí", "si", "quiero", "ok", "claro", "correcto", "de acuerdo"];
const respuestasNegativas = ["no", "no gracias", "no quiero", "tal vez después"];


const keywords = {
  servicios: ["servicios", "qué hacen", "qué ofrecen", "diseño", "programación", "web", "sistemas", "apps"],
  precios: ["precio", "cuánto", "costo", "tarifa", "valor", "presupuesto"],
  tiempos: ["tiempo", "entrega", "duran", "cuánto tardan", "deadline"],
  contacto: ["contacto", "comunicar", "correo", "email", "teléfono"],
};

router.post("/", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ reply: "Falta el userId o el mensaje." });
  }

  let userData = conversations[userId] || { etapa: "inicio" };
  // console.log(`Mensaje recibido: ${message}`);
  // console.log(`Estado actual del usuario:`, userData);
  if (message=='Chat') {
    conversations[userId] = { etapa: "inicio" };
    return res.json({ reply: "¡Hola! ¿En qué puedo ayudarte?" });
  }

  // Detectar saludo
  if (saludos.some((saludo) => message.toLowerCase().includes(saludo))) {
    conversations[userId] = { etapa: "inicio" };
    return res.json({ reply: "¡Hola! ¿En qué puedo ayudarte?" });
  }

  // Convertir mensaje a minúsculas
  const messageLowerCase = message.toLowerCase();

  // Buscar palabras clave en el mensaje
  let foundAnswer = null;
  let foundCategory = null;

  for (const category in keywords) {
    if (keywords[category].some((keyword) => messageLowerCase.includes(keyword))) {
      foundCategory = category;
      break;
    }
  }

// console.log(`Categoría encontrada: ${foundCategory}`);

  // Verificar si la categoría existe en knowledgeBase
  if (foundCategory && knowledgeBase.hasOwnProperty(foundCategory)) {
    foundAnswer = knowledgeBase[foundCategory];
  } else {
    // console.log(`⚠️ Error: No existe la categoría "${foundCategory}" en knowledgeBase.`);
  }

  // Si se encontró una respuesta, preguntar si el usuario desea contactar un asesor
  if (foundAnswer) {
    conversations[userId] = { etapa: "esperando_confirmacion" };
    return res.json({ reply: `${foundAnswer} ¿Quieres que un asesor se comunique contigo?` });
  }

  // Si no se encuentra una respuesta en la base de conocimientos
  if (userData.etapa === "inicio") {
    // console.log('primro a considerar');
    conversations[userId] = { etapa: "esperando_confirmacion" };
    return res.json({ reply: "Lo siento, esa información solo te la puede dar un asesor. ¿Quieres que un asesor te contacte?" });
  }

  // Manejo de respuestas afirmativas o negativas
  if (userData.etapa === "esperando_confirmacion") {
    if (respuestasAfirmativas.some((word) => messageLowerCase.includes(word))) {
      userData.etapa = "explicacion_datos";
      conversations[userId] = userData;
      return res.json({ reply: "Genial, para conectarte con un asesor, necesito algunos datos. Empecemos con tu nombre." });
    } else if (respuestasNegativas.some((word) => messageLowerCase.includes(word))) {
      delete conversations[userId];
      conversations[userId] = { etapa: "inicio" };
      return res.json({ reply: "Entendido, si necesitas ayuda en otro momento, estaré aquí. ¡Gracias!" });
    }
  }

  // Flujo de recolección de datos
  switch (userData.etapa) {
    case "explicacion_datos":
      userData.nombre = message;
      userData.etapa = "pedir_email";
      conversations[userId] = userData;
      return res.json({ reply: `Encantado, ${message}. ¿Cuál es tu correo electrónico?` });

    case "pedir_email":
      if (!message.includes("@") || !message.includes(".")) {
        return res.json({ reply: "El correo ingresado no es válido. Inténtalo de nuevo." });
      }
      userData.email = message;
      userData.etapa = "pedir_telefono";
      conversations[userId] = userData;
      return res.json({ reply: "Perfecto. Ahora, ¿podrías darme tu número de teléfono?" });

    case "pedir_telefono":
      if (!/^\d{10}$/.test(message)) {
        return res.json({ reply: "El número de teléfono debe contener exactamente 10 dígitos numéricos." });
      }
      userData.telefono = message;
      userData.etapa = "pedir_mensaje";
      conversations[userId] = userData;
      return res.json({ reply: "Gracias. Por último, ¿cuál es tu mensaje o consulta?" });

    case "pedir_mensaje":
      userData.mensaje = message;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: "garyfeomm@gmail.com",
          subject: "Nuevo mensaje del chatbot",
          text: `Nombre: ${userData.nombre}\nEmail: ${userData.email}\nTeléfono: ${userData.telefono}\nMensaje: ${userData.mensaje}`,
        });

        delete conversations[userId];
        return res.json({ reply: "¡Gracias! Tu mensaje ha sido enviado. Un asesor te contactará pronto." });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ reply: "Error al enviar el correo. Inténtalo más tarde." });
      }

    default:
      // Si no se encontró respuesta, preguntar a OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: message }],
      });

      return res.json({ reply: response.choices[0].message.content });
  }
});

module.exports = router;





    