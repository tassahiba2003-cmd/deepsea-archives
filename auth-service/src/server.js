// src/server.js
const express = require("express");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = 4000;

app.use(express.json());

app.use("/", authRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Serveur Auth lancé sur http://localhost:${PORT}`);
});