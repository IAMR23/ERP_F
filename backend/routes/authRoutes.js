const express = require("express");
const { login, me } = require("../controllers/authController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/api/v1/auth/login", login);
router.get("/api/v1/auth/me", authMiddleware, me);

module.exports = router;
