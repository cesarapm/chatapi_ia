const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
//   return res.json({ reply: "Este es otro chatbot para otro sitio." });
res.send("empezando")
});

module.exports = router;