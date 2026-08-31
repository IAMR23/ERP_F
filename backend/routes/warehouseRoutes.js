const express = require("express");
const {
  crearBodega,
  listarBodegas,
  obtenerOpcionesBodegas,
  registrarTransferenciaStock,
  registrarEntradaStock
} = require("../controllers/warehouseController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/api/v1/warehouses/options",
  authMiddleware,
  requirePermission("warehouse.read"),
  obtenerOpcionesBodegas
);

router.get(
  "/api/v1/warehouses",
  authMiddleware,
  requirePermission("warehouse.read"),
  listarBodegas
);

router.post(
  "/api/v1/warehouses",
  authMiddleware,
  requirePermission("warehouse.create"),
  crearBodega
);

router.post(
  "/api/v1/warehouses/:id/stock-entries",
  authMiddleware,
  requirePermission("stock_entry.create"),
  registrarEntradaStock
);

router.post(
  "/api/v1/warehouses/:id/transfers",
  authMiddleware,
  requirePermission("stock_transfer.create"),
  registrarTransferenciaStock
);

module.exports = router;
