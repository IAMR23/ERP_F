const express = require("express");
const {
  actualizarPersona,
  cambiarEstadoPersona,
  crearPersona,
  listarPersonas,
  obtenerPersona
} = require("../controllers/personController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/api/v1/people", authMiddleware, requirePermission("person.read"), listarPersonas);
router.get("/api/v1/people/:id", authMiddleware, requirePermission("person.read"), obtenerPersona);
router.post("/api/v1/people", authMiddleware, requirePermission("person.create"), crearPersona);
router.put("/api/v1/people/:id", authMiddleware, requirePermission("person.update"), actualizarPersona);
router.patch(
  "/api/v1/people/:id/status",
  authMiddleware,
  requirePermission("person.disable"),
  cambiarEstadoPersona
);

module.exports = router;
