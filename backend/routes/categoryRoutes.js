const express = require("express");
const {
  actualizarCategoria,
  crearCategoria,
  desactivarCategoria,
  listarCategorias
} = require("../controllers/categoryController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/api/v1/catalog/categories", authMiddleware, requirePermission("catalog.view"), listarCategorias);
router.post("/api/v1/catalog/categories", authMiddleware, requirePermission("catalog.create"), crearCategoria);
router.put("/api/v1/catalog/categories/:id", authMiddleware, requirePermission("catalog.update"), actualizarCategoria);
router.delete("/api/v1/catalog/categories/:id", authMiddleware, requirePermission("catalog.disable"), desactivarCategoria);

module.exports = router;
