// src/routes/observationRoutes.js
const express = require("express");
const router = express.Router();
const obsController = require("../controllers/observationController");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "SECRET_DE_L_ECOLE";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token manquant" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Token invalide" });
  }
};

router.post("/species", authenticate, obsController.createSpecies);
router.get("/species", authenticate, obsController.getAllSpecies);
router.get("/species/:id", authenticate, obsController.getSpeciesById);

router.post("/observations", authenticate, obsController.createObservation);
router.get("/species/:id/observations", authenticate, obsController.getObservationsBySpecies);

router.post("/observations/:id/validate", authenticate, obsController.validateObservation);
router.post("/observations/:id/reject", authenticate, obsController.rejectObservation);

module.exports = router;