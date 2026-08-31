const express = require("express");
const {
  actualizarEmpresa,
  actualizarConfiguracionEmpresa,
  actualizarSucursal,
  actualizarUsuarioEmpresa,
  crearEmpresa,
  crearSucursal,
  crearUsuarioEmpresa,
  desactivarEmpresa,
  desactivarSucursal,
  desactivarUsuarioEmpresa,
  obtenerConfiguracionEmpresa,
  listarEmpresas,
  listarSucursales,
  listarUsuariosEmpresa
} = require("../controllers/organizationController");
const { authMiddleware, requirePermission } = require("../middleware/authMiddleware");
const { companySettingsUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/api/v1/organization/companies", authMiddleware, requirePermission("company.view"), listarEmpresas);
router.get(
  "/api/v1/organization/company-settings",
  authMiddleware,
  requirePermission("company.view"),
  obtenerConfiguracionEmpresa
);
router.post("/api/v1/organization/companies", authMiddleware, requirePermission("company.create"), crearEmpresa);
router.put(
  "/api/v1/organization/companies/:id/settings",
  authMiddleware,
  requirePermission("company.update"),
  companySettingsUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "proformaSignature", maxCount: 1 }
  ]),
  actualizarConfiguracionEmpresa
);
router.put("/api/v1/organization/companies/:id", authMiddleware, requirePermission("company.update"), actualizarEmpresa);
router.delete("/api/v1/organization/companies/:id", authMiddleware, requirePermission("company.disable"), desactivarEmpresa);

router.get(
  "/api/v1/organization/company-users",
  authMiddleware,
  requirePermission("user.view"),
  listarUsuariosEmpresa
);
router.post(
  "/api/v1/organization/company-users",
  authMiddleware,
  requirePermission("user.manage"),
  crearUsuarioEmpresa
);
router.put(
  "/api/v1/organization/company-users/:id",
  authMiddleware,
  requirePermission("user.manage"),
  actualizarUsuarioEmpresa
);
router.delete(
  "/api/v1/organization/company-users/:id",
  authMiddleware,
  requirePermission("user.manage"),
  desactivarUsuarioEmpresa
);

router.get("/api/v1/organization/branches", authMiddleware, requirePermission("branch.view"), listarSucursales);
router.post("/api/v1/organization/branches", authMiddleware, requirePermission("branch.create"), crearSucursal);
router.put("/api/v1/organization/branches/:id", authMiddleware, requirePermission("branch.update"), actualizarSucursal);
router.delete("/api/v1/organization/branches/:id", authMiddleware, requirePermission("branch.disable"), desactivarSucursal);

module.exports = router;
