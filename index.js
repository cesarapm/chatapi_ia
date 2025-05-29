require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet"); // Agregar helmet

const app = express();

// Configurar Content Security Policy (CSP) usando helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // Permite contenido solo desde el mismo origen
        styleSrc: ["'self'", "https://fonts.googleapis.com"], // Permite cargar estilos de Google Fonts
        fontSrc: ["'self'", "https://fonts.gstatic.com"], // Permite cargar fuentes de Google Fonts
      },
    },
  })
);

// Configurar CORS para permitir solicitudes desde cualquier origen
// Para producción, deberías restringir el origen a tu dominio frontend
app.use(
  cors({
    origin: "*", // Permite solicitudes de todos los orígenes (puedes cambiar "*" por tu dominio en producción)
  })
);

// Usar body-parser para procesar las solicitudes JSON
app.use(bodyParser.json());

// Importar las rutas para los diferentes endpoints
const chatbotRoutes = require("./routes/chatbot");
const otroChatRoutes = require("./routes/conectado");
const aces =require("./routes/aces"); 
// const RockwandChatRoutes = require("./routes/rockwand");

// Usar las rutas definidas
app.use("/chatbot", chatbotRoutes);
app.use("/conectado", otroChatRoutes);
app.use("/aces", aces);
// app.use("/apirockwand", RockwandChatRoutes);

// Obtener el puerto desde la variable de entorno de Render
const PORT = process.env.PORT || 3001;

// Iniciar el servidor en el puerto asignado
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
