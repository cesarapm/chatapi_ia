require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet"); // Agregar helmet

const app = express();

// Configurar Content Security Policy (CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    },
  })
);

app.use(cors());
app.use(bodyParser.json());

// Importar rutas
const chatbotRoutes = require("./routes/chatbot");
const otroChatRoutes = require("./routes/conectado");

app.use("/chatbot", chatbotRoutes);
app.use("/conectado", otroChatRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
