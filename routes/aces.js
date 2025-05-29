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
  financing: "Yes, we do offer financing.",
  financing_options: "Yes, we have programs for both. With land, you can do 0 down payment. Without land, a down payment is required.",
  permits: "Yes, we take care of the permits.",
  itin: "Yes, we have lenders that accept ITIN or Social.",
  own_land: "If you own the land, the next step is to submit an application so we can determine your budget. Then, you can choose models within that price range.",
  process_time: "Depending on the permits, the process can take from 4 to 6 months, or even faster depending on the county.",
  customization: "Yes, we have architects ready to modify, add, or design your dream home.",
  interior_finish: "Yes, 100% of our homes come with crown molding and wood trim.",
  full_support: "Yes, we assist with financing, delivery, permits, setup, excavation, concrete, and finishes.",
  next_step: "Send us your information today to get started!",
};

const conversations = {};

const saludos = ["hi", "hello", "good morning", "good afternoon", "what's up", "hey"];
const respuestasAfirmativas = ["yes", "yeah", "i do", "ok", "sure", "correct", "agreed"];
const respuestasNegativas = ["no", "no thanks", "i don't want", "maybe later"];


const keywords = {
  financing: ["finance", "financing", "do you finance", "loan"],
  financing_options: ["land", "with land", "without land", "down payment"],
  permits: ["permit", "permits", "do you take care of permits"],
  itin: ["itin", "social", "can I qualify with itin"],
  own_land: ["own land", "have land", "i own the land"],
  process_time: ["how long", "process", "delivery time", "build time"],
  customization: ["customize", "custom home", "architect", "modify"],
  interior_finish: ["tape and texture", "molding", "wood trim", "finishes"],
  full_support: ["start to finish", "help with", "assist", "support"],
  next_step: ["what's next", "next", "get started", "send info"],
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
    return res.json({ reply: "Hello! How can I help you?" });
  }

  // Detectar saludo
  if (saludos.some((saludo) => message.toLowerCase().includes(saludo))) {
    conversations[userId] = { etapa: "inicio" };
    return res.json({ reply: "Hello! How can I help you?" });
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
    return res.json({ reply: `${foundAnswer} Would you like an advisor to contact you?` });
  }

  // Si no se encuentra una respuesta en la base de conocimientos
  if (userData.etapa === "inicio") {
    // console.log('primro a considerar');
    conversations[userId] = { etapa: "esperando_confirmacion" };
    return res.json({ reply: "Sorry, only an advisor can give you that information. Would you like an advisor to contact you?" });
  }

  // Manejo de respuestas afirmativas o negativas
  if (userData.etapa === "esperando_confirmacion") {
    if (respuestasAfirmativas.some((word) => messageLowerCase.includes(word))) {
      userData.etapa = "explicacion_datos";
      conversations[userId] = userData;
      return res.json({ reply: "Great, to connect you with an advisor, I need some information. Let's start with your name." });
    } else if (respuestasNegativas.some((word) => messageLowerCase.includes(word))) {
      delete conversations[userId];
      conversations[userId] = { etapa: "inicio" };
      return res.json({ reply: "Understood, if you need help another time, I'll be here. Thanks!" });
    }
  }

  // Flujo de recolección de datos
  switch (userData.etapa) {
    case "explicacion_datos":
      userData.nombre = message;
      userData.etapa = "pedir_email";
      conversations[userId] = userData;
      return res.json({ reply: `Nice to meet you, ${message}. What's your email address?`});

    case "pedir_email":
      if (!message.includes("@") || !message.includes(".")) {
        return res.json({ reply: "The email address you entered is invalid. Please try again." });
      }
      userData.email = message;
      userData.etapa = "pedir_telefono";
      conversations[userId] = userData;
      return res.json({ reply: "Perfect. Now, could you give me your phone number?" });

    case "pedir_telefono":
      if (!/^\d{10}$/.test(message)) {
        return res.json({ reply: "The phone number must contain exactly 10 numeric digits." });
      }
      userData.telefono = message;
      userData.etapa = "pedir_mensaje";
      conversations[userId] = userData;
      return res.json({ reply: "Thank you. Finally, what is your message or question?" });

    case "pedir_mensaje":
      userData.mensaje = message;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: "garyfeomm@gmail.com",
          subject: "New message from the chatbot",
          text: `Name: ${userData.nombre}\nEmail: ${userData.email}\nPhone: ${userData.telefono}\nMessage: ${userData.mensaje}`,
        });

        delete conversations[userId];
        return res.json({ reply: "Thank you! Your message has been sent. An advisor will contact you shortly." });
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





    