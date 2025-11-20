// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Quand on envoie une info sur /register, ça active le contrôleur
router.post("/register", authController.register);

module.exports = router;