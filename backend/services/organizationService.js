const bcrypt = require("bcryptjs");
const { prisma } = require("../config/db");
const {
  compressCompanyImage,
  removeStoredImage,
  storeCompanyProformaSignature
} = require("./imageService");

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeStatus(status) {
  return status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function scopedCompanyWhere(user, where = {}) {
  const scopes = [{ tenantId: user.tenantId, ...where }];

  if (user.companyIds.length) {
    scopes.push({ id: { in: user.companyIds } });
  }

  return { AND: scopes };
}

function scopedBranchWhere(user, where = {}) {
  const scopes = [{ tenantId: user.tenantId, ...where }];

  if (user.companyIds.length) {
    scopes.push({ companyId: { in: user.companyIds } });
  }

  if (user.branchIds.length) {
    scopes.push({ id: { in: user.branchIds } });
  }

  return { AND: scopes };
}

function trimOrEmpty(value) {
  return String(value || "").trim();
}

function optionalString(value) {
  return value === undefined ? undefined : trimOrEmpty(value);
}

function optionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  return value === true || value === "true" || value === "SI" || value === "1";
}

function parseDecimalPlaces(value) {
  if (value === undefined || value === "") {
    return undefined;
  }

  const decimals = Number(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw badRequest("El numero de decimales debe estar entre 0 y 6");
  }

  return decimals;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

async function ensureCompany(user, id, where = {}) {
  const company = await prisma.company.findFirst({
    where: scopedCompanyWhere(user, { id, ...where })
  });

  if (!company) {
    throw notFound("Empresa no encontrada");
  }

  return company;
}

async function ensureBranch(user, id, where = {}) {
  const branch = await prisma.branch.findFirst({
    where: scopedBranchWhere(user, { id, ...where })
  });

  if (!branch) {
    throw notFound("Sucursal no encontrada");
  }

  return branch;
}

function companySelect() {
  return {
    id: true,
    legalName: true,
    tradeName: true,
    ruc: true,
    mainAddress: true,
    email: true,
    phone: true,
    logoObjectKey: true,
    establishmentNumber: true,
    accountingRequired: true,
    specialContributor: true,
    largeTaxpayer: true,
    exporter: true,
    exporterType: true,
    rimpe: true,
    withholdingAgent: true,
    city: true,
    decimalPlaces: true,
    notificationEmail: true,
    proformaSignatureKey: true,
    quoteWarranty: true,
    quotePaymentMethod: true,
    status: true,
    sriEnvironment: true,
    currency: true,
    timezone: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        branches: true,
        warehouses: true,
        catalogItems: true
      }
    }
  };
}

function branchSelect() {
  return {
    id: true,
    tenantId: true,
    companyId: true,
    code: true,
    name: true,
    address: true,
    phone: true,
    email: true,
    managerName: true,
    status: true,
    sriEstablishmentCode: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { id: true, tradeName: true, ruc: true } },
    _count: {
      select: {
        warehouses: true,
        userScopes: true
      }
    }
  };
}

function managedUserSelect() {
  return {
    id: true,
    username: true,
    email: true,
    name: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    roles: { include: { role: { select: { id: true, name: true } } } },
    branchScopes: {
      include: {
        branch: { select: { id: true, code: true, name: true, companyId: true } }
      }
    },
    companyScopes: true
  };
}

function mapManagedUser(user) {
  const role = user.roles[0]?.role || null;
  const branch = user.branchScopes[0]?.branch || null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    status: user.status,
    roleId: role?.id || "",
    roleName: role?.name || "",
    branchId: branch?.id || "",
    branchName: branch?.name || "",
    branchCode: branch?.code || "",
    companyId: branch?.companyId || user.companyScopes[0]?.companyId || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function scopedUserWhere(user, where = {}) {
  const scopes = [{ tenantId: user.tenantId, ...where }];

  if (user.companyIds.length) {
    scopes.push({ companyScopes: { some: { companyId: { in: user.companyIds } } } });
  }

  if (user.branchIds.length) {
    scopes.push({ branchScopes: { some: { branchId: { in: user.branchIds } } } });
  }

  return { AND: scopes };
}

async function ensureRole(user, roleId) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId: user.tenantId, status: "ACTIVE" }
  });

  if (!role) {
    throw notFound("Rol no encontrado");
  }

  return role;
}

async function ensureUniqueUserIdentity(tenantId, { email, username }, excludeId) {
  const existingUser = await prisma.user.findFirst({
    where: {
      tenantId,
      OR: [{ email }, { username }],
      ...(excludeId ? { id: { not: excludeId } } : {})
    }
  });

  if (existingUser?.email === email) {
    throw badRequest("Ya existe un usuario con ese correo");
  }

  if (existingUser?.username === username) {
    throw badRequest("Ya existe un usuario con ese usuario");
  }
}

async function listCompanies(user) {
  return prisma.company.findMany({
    where: scopedCompanyWhere(user),
    select: companySelect(),
    orderBy: [{ status: "asc" }, { tradeName: "asc" }]
  });
}

async function getCompanySettings(user, companyId) {
  const company = companyId
    ? await ensureCompany(user, companyId)
    : await prisma.company.findFirst({
        where: scopedCompanyWhere(user, { status: "ACTIVE" }),
        select: companySelect(),
        orderBy: { createdAt: "asc" }
      });

  if (!company) {
    throw notFound("Empresa no encontrada");
  }

  return company;
}

async function listCompanyUsers(user) {
  const [users, roles, branches] = await Promise.all([
    prisma.user.findMany({
      where: scopedUserWhere(user),
      select: managedUserSelect(),
      orderBy: [{ status: "asc" }, { name: "asc" }]
    }),
    prisma.role.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.branch.findMany({
      where: scopedBranchWhere(user, { status: "ACTIVE" }),
      select: {
        id: true,
        code: true,
        name: true,
        companyId: true,
        company: { select: { tradeName: true } }
      },
      orderBy: [{ companyId: "asc" }, { code: "asc" }]
    })
  ]);

  return {
    users: users.map(mapManagedUser),
    roles,
    branches: branches.map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      companyId: branch.companyId,
      companyName: branch.company.tradeName
    }))
  };
}

async function createCompanyUser(user, body) {
  const name = trimOrEmpty(body.name);
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!name || !username || !email || !password || !body.roleId || !body.branchId) {
    throw badRequest("Nombre, usuario, correo, contrasena, rol y sucursal son requeridos");
  }

  if (password.length < 6) {
    throw badRequest("La contrasena debe tener al menos 6 caracteres");
  }

  const branch = await ensureBranch(user, body.branchId, { status: "ACTIVE" });
  const role = await ensureRole(user, body.roleId);
  await ensureUniqueUserIdentity(user.tenantId, { email, username });

  const passwordHash = await bcrypt.hash(password, 12);

  const createdUser = await prisma.$transaction(async (tx) =>
    tx.user.create({
      data: {
        tenantId: user.tenantId,
        username,
        email,
        name,
        passwordHash,
        status: normalizeStatus(body.status),
        roles: { create: { roleId: role.id } },
        companyScopes: { create: { companyId: branch.companyId } },
        branchScopes: { create: { branchId: branch.id } }
      },
      select: managedUserSelect()
    })
  );

  return mapManagedUser(createdUser);
}

async function updateCompanyUser(user, id, body) {
  const existingUser = await prisma.user.findFirst({
    where: scopedUserWhere(user, { id }),
    select: managedUserSelect()
  });

  if (!existingUser) {
    throw notFound("Usuario no encontrado");
  }

  const data = {
    name: optionalString(body.name),
    username: body.username !== undefined ? normalizeUsername(body.username) : undefined,
    email: body.email !== undefined ? normalizeEmail(body.email) : undefined
  };

  if (body.status !== undefined) data.status = normalizeStatus(body.status);

  if (body.password) {
    if (String(body.password).length < 6) {
      throw badRequest("La contrasena debe tener al menos 6 caracteres");
    }
    data.passwordHash = await bcrypt.hash(String(body.password), 12);
  }

  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

  if (!data.name && body.name !== undefined) {
    throw badRequest("El nombre es requerido");
  }

  if (!data.username && body.username !== undefined) {
    throw badRequest("El usuario es requerido");
  }

  if (!data.email && body.email !== undefined) {
    throw badRequest("El correo es requerido");
  }

  await ensureUniqueUserIdentity(user.tenantId, {
    email: data.email || existingUser.email,
    username: data.username || existingUser.username
  }, id);

  const branch = body.branchId ? await ensureBranch(user, body.branchId, { status: "ACTIVE" }) : null;
  const role = body.roleId ? await ensureRole(user, body.roleId) : null;

  const updatedUser = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });

    if (role) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.create({ data: { userId: id, roleId: role.id } });
    }

    if (branch) {
      await tx.userCompanyScope.deleteMany({ where: { userId: id } });
      await tx.userCompanyScope.create({
        data: { userId: id, companyId: branch.companyId }
      });
      await tx.userBranchScope.deleteMany({ where: { userId: id } });
      await tx.userBranchScope.create({
        data: { userId: id, branchId: branch.id }
      });
    }

    return tx.user.findUnique({ where: { id }, select: managedUserSelect() });
  });

  return mapManagedUser(updatedUser);
}

async function disableCompanyUser(user, id) {
  if (id === user.id) {
    throw badRequest("No puedes desactivar tu propio usuario");
  }

  const existingUser = await prisma.user.findFirst({
    where: scopedUserWhere(user, { id })
  });

  if (!existingUser) {
    throw notFound("Usuario no encontrado");
  }

  const disabledUser = await prisma.user.update({
    where: { id },
    data: { status: "INACTIVE" },
    select: managedUserSelect()
  });

  return mapManagedUser(disabledUser);
}

async function createCompany(user, body) {
  if (!body.legalName?.trim() || !body.tradeName?.trim() || !body.ruc?.trim()) {
    throw badRequest("Razon social, nombre comercial y RUC son requeridos");
  }

  return prisma.company.create({
    data: {
      tenantId: user.tenantId,
      legalName: body.legalName.trim(),
      tradeName: body.tradeName.trim(),
      ruc: body.ruc.trim(),
      mainAddress: trimOrEmpty(body.mainAddress),
      email: trimOrEmpty(body.email),
      phone: trimOrEmpty(body.phone),
      status: normalizeStatus(body.status),
      sriEnvironment: body.sriEnvironment === "PRODUCTION" ? "PRODUCTION" : "TEST",
      currency: trimOrEmpty(body.currency) || "USD",
      timezone: trimOrEmpty(body.timezone) || "America/Guayaquil",
      createdBy: user.id
    },
    select: companySelect()
  });
}

async function updateCompany(user, id, body) {
  await ensureCompany(user, id);

  const data = {
    legalName: optionalString(body.legalName),
    tradeName: optionalString(body.tradeName),
    ruc: optionalString(body.ruc),
    mainAddress: optionalString(body.mainAddress),
    email: optionalString(body.email),
    phone: optionalString(body.phone),
    currency: optionalString(body.currency),
    timezone: optionalString(body.timezone)
  };

  if (body.status !== undefined) data.status = normalizeStatus(body.status);
  if (body.sriEnvironment !== undefined) {
    data.sriEnvironment = body.sriEnvironment === "PRODUCTION" ? "PRODUCTION" : "TEST";
  }

  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

  if (!data.legalName && body.legalName !== undefined) {
    throw badRequest("La razon social es requerida");
  }

  if (!data.tradeName && body.tradeName !== undefined) {
    throw badRequest("El nombre comercial es requerido");
  }

  if (!data.ruc && body.ruc !== undefined) {
    throw badRequest("El RUC es requerido");
  }

  return prisma.company.update({
    where: { id },
    data,
    select: companySelect()
  });
}

async function updateCompanySettings(user, id, body, files = {}) {
  const company = await ensureCompany(user, id);
  const logo = await compressCompanyImage(files.logo?.[0], {
    width: 500,
    height: 300,
    quality: 78
  });
  const proformaSignature = await storeCompanyProformaSignature(files.proformaSignature?.[0]);

  const data = {
    legalName: optionalString(body.legalName),
    tradeName: optionalString(body.tradeName),
    ruc: optionalString(body.ruc),
    establishmentNumber: optionalString(body.establishmentNumber),
    accountingRequired: optionalBoolean(body.accountingRequired),
    specialContributor: optionalBoolean(body.specialContributor),
    largeTaxpayer: optionalBoolean(body.largeTaxpayer),
    exporter: optionalBoolean(body.exporter),
    exporterType:
      body.exporterType === "HABITUAL" || body.exporterType === "NO_HABITUAL"
        ? body.exporterType
        : undefined,
    rimpe: optionalBoolean(body.rimpe),
    withholdingAgent: optionalBoolean(body.withholdingAgent),
    city: optionalString(body.city),
    phone: optionalString(body.phone),
    mainAddress: optionalString(body.mainAddress),
    decimalPlaces: parseDecimalPlaces(body.decimalPlaces),
    notificationEmail: optionalString(body.notificationEmail),
    quoteWarranty: optionalString(body.quoteWarranty),
    quotePaymentMethod: optionalString(body.quotePaymentMethod)
  };

  if (logo) data.logoObjectKey = logo.objectKey;
  if (proformaSignature) data.proformaSignatureKey = proformaSignature.objectKey;

  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

  if (!data.legalName && body.legalName !== undefined) {
    throw badRequest("La razon social es requerida");
  }

  if (!data.tradeName && body.tradeName !== undefined) {
    throw badRequest("El nombre comercial es requerido");
  }

  if (!data.ruc && body.ruc !== undefined) {
    throw badRequest("El RUC es requerido");
  }

  const updatedCompany = await prisma.company.update({
    where: { id: company.id },
    data,
    select: companySelect()
  });

  if (logo && company.logoObjectKey) {
    await removeStoredImage(company.logoObjectKey);
  }

  if (proformaSignature && company.proformaSignatureKey) {
    await removeStoredImage(company.proformaSignatureKey);
  }

  return updatedCompany;
}

async function disableCompany(user, id) {
  await ensureCompany(user, id);

  return prisma.company.update({
    where: { id },
    data: { status: "INACTIVE" },
    select: companySelect()
  });
}

async function listBranches(user, companyId) {
  return prisma.branch.findMany({
    where: scopedBranchWhere(user, companyId ? { companyId } : {}),
    select: branchSelect(),
    orderBy: [{ status: "asc" }, { companyId: "asc" }, { code: "asc" }]
  });
}

async function createBranch(user, body) {
  if (!body.companyId || !body.code?.trim() || !body.name?.trim()) {
    throw badRequest("Empresa, codigo y nombre son requeridos");
  }

  const company = await ensureCompany(user, body.companyId, { status: "ACTIVE" });

  return prisma.branch.create({
    data: {
      tenantId: user.tenantId,
      companyId: company.id,
      code: body.code.trim().toUpperCase(),
      name: body.name.trim(),
      address: trimOrEmpty(body.address),
      phone: trimOrEmpty(body.phone),
      email: trimOrEmpty(body.email),
      managerName: trimOrEmpty(body.managerName),
      status: normalizeStatus(body.status),
      sriEstablishmentCode: trimOrEmpty(body.sriEstablishmentCode) || "001"
    },
    select: branchSelect()
  });
}

async function updateBranch(user, id, body) {
  const branch = await ensureBranch(user, id);

  if (body.companyId && body.companyId !== branch.companyId) {
    throw badRequest("No se puede cambiar la empresa de una sucursal existente");
  }

  const data = {
    code: optionalString(body.code)?.toUpperCase(),
    name: optionalString(body.name),
    address: optionalString(body.address),
    phone: optionalString(body.phone),
    email: optionalString(body.email),
    managerName: optionalString(body.managerName),
    sriEstablishmentCode: optionalString(body.sriEstablishmentCode)
  };

  if (body.status !== undefined) data.status = normalizeStatus(body.status);
  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);

  if (!data.code && body.code !== undefined) {
    throw badRequest("El codigo de sucursal es requerido");
  }

  if (!data.name && body.name !== undefined) {
    throw badRequest("El nombre de sucursal es requerido");
  }

  return prisma.branch.update({
    where: { id },
    data,
    select: branchSelect()
  });
}

async function disableBranch(user, id) {
  await ensureBranch(user, id);

  return prisma.branch.update({
    where: { id },
    data: { status: "INACTIVE" },
    select: branchSelect()
  });
}

module.exports = {
  listCompanies,
  getCompanySettings,
  listCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  disableCompanyUser,
  createCompany,
  updateCompany,
  updateCompanySettings,
  disableCompany,
  listBranches,
  createBranch,
  updateBranch,
  disableBranch
};
