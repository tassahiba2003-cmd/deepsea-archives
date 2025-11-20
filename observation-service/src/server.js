// src/server.js
const express = require("express");
const obsRoutes = require("./routes/observationRoutes");

const app = express();
const PORT = 5000; 

app.use(express.json()); // Pour comprendre le JSON

// On branche les routes
app.use("/", obsRoutes);

app.listen(PORT, () => {
  console.log(`Observation-Service en ligne sur http://localhost:${PORT}`);
});