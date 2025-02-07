require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Importar rutas
const chatbotRoutes = require("./routes/chatbot");
const otroChatRoutes = require("./routes/conectado");

app.use("/chatbot", chatbotRoutes);

app.use("/conectado", otroChatRoutes);



app.listen(3001, () => console.log("Servidor en http://localhost:3001"));
