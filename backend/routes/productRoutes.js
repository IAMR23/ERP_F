const express = require("express");
const {
  actualizarProducto,
  crearProducto,
  desactivarProducto,
  listarEmpresas,
  listarProductos,
  obtenerProducto
} = require("../controllers/productController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");
const { imageUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/api/v1/catalog/companies", authMiddleware, requirePermission("company.view"), listarEmpresas);
router.get("/api/v1/catalog/products", authMiddleware, requirePermission("catalog.view"), listarProductos);
router.get("/api/v1/catalog/products/:id", authMiddleware, requirePermission("catalog.view"), obtenerProducto);
router.post(
  "/api/v1/catalog/products",
  authMiddleware,
  requirePermission("catalog.create"),
  imageUpload.single("image"),
  crearProducto
);
router.put(
  "/api/v1/catalog/products/:id",
  authMiddleware,
  requirePermission("catalog.update"),
  imageUpload.single("image"),
  actualizarProducto
);
router.delete("/api/v1/catalog/products/:id", authMiddleware, requirePermission("catalog.disable"), desactivarProducto);

module.exports = router;
