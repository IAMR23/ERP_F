const organizationService = require("../services/organizationService");

function handleKnownPrismaError(error, next) {
  if (error.code === "P2002") {
    const message = error.meta?.target?.includes("ruc")
      ? "Ya existe una empresa con ese RUC"
      : "Ya existe un registro con esos datos";
    const conflict = new Error(message);
    conflict.statusCode = 400;
    return next(conflict);
  }

  return next(error);
}

function handleKnownUserError(error, next) {
  if (error.code === "P2002") {
    const target = error.meta?.target || [];
    const message = target.includes("email")
      ? "Ya existe un usuario con ese correo"
      : target.includes("username")
        ? "Ya existe un usuario con ese usuario"
        : "Ya existe un registro con esos datos";
    const conflict = new Error(message);
    conflict.statusCode = 400;
    return next(conflict);
  }

  return next(error);
}

async function listarEmpresas(req, res, next) {
  try {
    const companies = await organizationService.listCompanies(req.user);
    return res.json({ companies });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function obtenerConfiguracionEmpresa(req, res, next) {
  try {
    const company = await organizationService.getCompanySettings(req.user, req.query.companyId);
    return res.json({ company });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function listarUsuariosEmpresa(req, res, next) {
  try {
    const data = await organizationService.listCompanyUsers(req.user);
    return res.json(data);
  } catch (error) {
    return handleKnownUserError(error, next);
  }
}

async function crearUsuarioEmpresa(req, res, next) {
  try {
    const user = await organizationService.createCompanyUser(req.user, req.body);
    return res.status(201).json({ user });
  } catch (error) {
    return handleKnownUserError(error, next);
  }
}

async function actualizarUsuarioEmpresa(req, res, next) {
  try {
    const user = await organizationService.updateCompanyUser(req.user, req.params.id, req.body);
    return res.json({ user });
  } catch (error) {
    return handleKnownUserError(error, next);
  }
}

async function desactivarUsuarioEmpresa(req, res, next) {
  try {
    const user = await organizationService.disableCompanyUser(req.user, req.params.id);
    return res.json({ user });
  } catch (error) {
    return handleKnownUserError(error, next);
  }
}

async function crearEmpresa(req, res, next) {
  try {
    const company = await organizationService.createCompany(req.user, req.body);
    return res.status(201).json({ company });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function actualizarEmpresa(req, res, next) {
  try {
    const company = await organizationService.updateCompany(req.user, req.params.id, req.body);
    return res.json({ company });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function actualizarConfiguracionEmpresa(req, res, next) {
  try {
    const company = await organizationService.updateCompanySettings(
      req.user,
      req.params.id,
      req.body,
      req.files
    );
    return res.json({ company });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function desactivarEmpresa(req, res, next) {
  try {
    const company = await organizationService.disableCompany(req.user, req.params.id);
    return res.json({ company });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function listarSucursales(req, res, next) {
  try {
    const branches = await organizationService.listBranches(req.user, req.query.companyId);
    return res.json({ branches });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function crearSucursal(req, res, next) {
  try {
    const branch = await organizationService.createBranch(req.user, req.body);
    return res.status(201).json({ branch });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function actualizarSucursal(req, res, next) {
  try {
    const branch = await organizationService.updateBranch(req.user, req.params.id, req.body);
    return res.json({ branch });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

async function desactivarSucursal(req, res, next) {
  try {
    const branch = await organizationService.disableBranch(req.user, req.params.id);
    return res.json({ branch });
  } catch (error) {
    return handleKnownPrismaError(error, next);
  }
}

module.exports = {
  listarEmpresas,
  obtenerConfiguracionEmpresa,
  listarUsuariosEmpresa,
  crearUsuarioEmpresa,
  actualizarUsuarioEmpresa,
  desactivarUsuarioEmpresa,
  crearEmpresa,
  actualizarEmpresa,
  actualizarConfiguracionEmpresa,
  desactivarEmpresa,
  listarSucursales,
  crearSucursal,
  actualizarSucursal,
  desactivarSucursal
};
