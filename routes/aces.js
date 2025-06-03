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
const respuestasAfirmativas = ["yes", "yeah", "i do", "ok", "sure", "correct", "agreed","si"];
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
// 👇 Agrega esta función antes de router.post
function containsExplicitQuestion(message) {
  const questionWords = ["what", "how", "when", "where", "who", "which", "can", "do", "does", "is", "are"];
  const msg = message.toLowerCase();
  return (
    msg.includes("?") ||
    questionWords.some((word) => msg.startsWith(word) || msg.includes(" " + word + " "))
  );
}
router.post("/", async (req, res) => {
  const { userId, message } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ reply: "Missing userId or message." });
  }

  let userData = conversations[userId] || { etapa: "inicio" };
  const messageLowerCase = message.toLowerCase();

  if (message === "Chat") {
    conversations[userId] = { etapa: "inicio" };
    return res.json({ reply: "Hello! How can I help you?" });
  }

  // 👉 Primero verificamos si contiene una pregunta
  let foundAnswer = null;
  let foundCategory = null;
  const isQuestion = containsExplicitQuestion(message);

  if (isQuestion) {
    for (const category in keywords) {
      if (keywords[category].some((keyword) => messageLowerCase.includes(keyword))) {
        foundCategory = category;
        break;
      }
    }
  }

  // 👉 Si no se encontró por pregunta, buscar por keywords igual
  if (!foundCategory) {
    for (const category in keywords) {
      if (keywords[category].some((keyword) => messageLowerCase.includes(keyword))) {
        foundCategory = category;
        break;
      }
    }
  }

  if (foundCategory && knowledgeBase.hasOwnProperty(foundCategory)) {
    foundAnswer = knowledgeBase[foundCategory];
  }

  if (foundAnswer) {
    conversations[userId] = { etapa: "esperando_confirmacion" };
    return res.json({ reply: `${foundAnswer} Would you like an advisor to contact you?` });
  }

  // ✅ Solo si no hay respuesta útil, responder saludo si aplica
  if (saludos.some((saludo) => messageLowerCase.includes(saludo))) {
    conversations[userId] = { etapa: "inicio" };
    return res.json({ reply: "Hello! How can I help you?" });
  }

  // 👇 Aquí sigue todo el flujo como lo tenías
  if (userData.etapa === "inicio") {
    conversations[userId] = { etapa: "esperando_confirmacion" };
    return res.json({ reply: "Sorry, only an advisor can give you that information. Would you like an advisor to contact you?" });
  }

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

  switch (userData.etapa) {
    case "explicacion_datos":
      userData.nombre = message;
      userData.etapa = "pedir_email";
      conversations[userId] = userData;
      return res.json({ reply: `Nice to meet you, ${message}. What's your email address?` });

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
          to: "Dio@4aceshomes.com",
          subject: "New message from the chatbot",
          text: `Name: ${userData.nombre}\nEmail: ${userData.email}\nPhone: ${userData.telefono}\nMessage: ${userData.mensaje}`,
        });

        delete conversations[userId];
        return res.json({ reply: "Thank you! Your message has been sent. An advisor will contact you shortly." });
      } catch (error) {
        console.log(error);
        return res.status(500).json({ reply: "There was an error sending your message. Please try again later." });
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





    