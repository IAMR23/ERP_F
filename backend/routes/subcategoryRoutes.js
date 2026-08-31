const express = require("express");
const {
  actualizarSubcategoria,
  crearSubcategoria,
  desactivarSubcategoria,
  listarSubcategorias
} = require("../controllers/subcategoryController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/api/v1/catalog/subcategories", authMiddleware, requirePermission("catalog.view"), listarSubcategorias);
router.post("/api/v1/catalog/subcategories", authMiddleware, requirePermission("catalog.create"), crearSubcategoria);
router.put("/api/v1/catalog/subcategories/:id", authMiddleware, requirePermission("catalog.update"), actualizarSubcategoria);
router.delete("/api/v1/catalog/subcategories/:id", authMiddleware, requirePermission("catalog.disable"), desactivarSubcategoria);

module.exports = router;
