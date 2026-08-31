const express = require("express");
const {
  actualizarFormaPago,
  crearFormaPago,
  desactivarFormaPago,
  listarFormasPago,
  obtenerFormaPago
} = require("../controllers/paymentMethodController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/api/v1/payment-methods",
  authMiddleware,
  requirePermission("catalog.view"),
  listarFormasPago
);
router.get(
  "/api/v1/payment-methods/:id",
  authMiddleware,
  requirePermission("catalog.view"),
  obtenerFormaPago
);
router.post(
  "/api/v1/payment-methods",
  authMiddleware,
  requirePermission("catalog.create"),
  crearFormaPago
);
router.put(
  "/api/v1/payment-methods/:id",
  authMiddleware,
  requirePermission("catalog.update"),
  actualizarFormaPago
);
router.delete(
  "/api/v1/payment-methods/:id",
  authMiddleware,
  requirePermission("catalog.disable"),
  desactivarFormaPago
);

module.exports = router;
