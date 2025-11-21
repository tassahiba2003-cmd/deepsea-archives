// src/server.js
const express = require("express");
const taxonomyRoutes = require("./routes/taxonomyRoutes");

const app = express();
const PORT = 6000;

app.use(express.json());

app.use("/", taxonomyRoutes);

app.listen(PORT, () => {
  console.log(`📊 Taxonomy-Service en ligne sur http://localhost:${PORT}`);
});