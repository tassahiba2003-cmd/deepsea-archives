// src/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");


router.post("/auth/login", authController.login);
router.post("/auth/register", authController.register);
router.get("/admin/users", authController.getAllUsers);
router.patch("/users/:id/role", authController.updateRole);
router.get("/auth/me", authController.getMe);
router.patch("/users/:id/reputation", authController.incrementReputation);

module.exports = router;