const express = require("express");
const {
  crearDocumento,
  enviarDocumentoSri,
  listarDocumentos,
  obtenerDocumento,
  validarFacturaNotaCredito,
  validarDocumentoSri
} = require("../controllers/documentController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/api/v1/documents", authMiddleware, requirePermission("sale.read"), listarDocumentos);
router.post(
  "/api/v1/documents/:id/sri/validate",
  authMiddleware,
  requirePermission("sale.create"),
  validarDocumentoSri
);
router.post(
  "/api/v1/documents/:id/sri/send",
  authMiddleware,
  requirePermission("sale.create"),
  enviarDocumentoSri
);
router.post(
  "/api/v1/documents/credit-notes/validate",
  authMiddleware,
  requirePermission("sale.read"),
  validarFacturaNotaCredito
);
router.get("/api/v1/documents/:id", authMiddleware, requirePermission("sale.read"), obtenerDocumento);
router.post("/api/v1/documents", authMiddleware, requirePermission("sale.create"), crearDocumento);

module.exports = router;
