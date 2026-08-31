const express = require("express");
const { obtenerDashboard } = require("../controllers/dashboardController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/api/v1/dashboard", authMiddleware, obtenerDashboard);

module.exports = router;
