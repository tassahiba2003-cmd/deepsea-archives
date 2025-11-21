const express = require("express");
const router = express.Router();
const taxonomyController = require("../controllers/taxonomyController");

// Route demandée par le sujet
router.get("/taxonomy/stats", taxonomyController.getStats);

module.exports = router;