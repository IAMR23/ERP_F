const { prisma } = require("../config/db");

const TIPO_PERSONA = ["NATURAL", "JURIDICA"];
const TIPO_IDENTIFICACION = ["CEDULA", "RUC", "PASAPORTE"];
const ROLES = ["CLIENTE", "PROVEEDOR", "EMPLEADO", "VENDEDOR"];

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

function personSelect() {
  return {
    id: true,
    tenantId: true,
    companyId: true,
    tipoPersona: true,
    tipoIdentificacion: true,
    identificacion: true,
    nombre: true,
    telefono: true,
    email: true,
    direccion: true,
    activo: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { id: true, tradeName: true } },
    roles: { select: { role: true } }
  };
}

function formatPerson(person) {
  return {
    ...person,
    roles: ROLES.filter((role) => person.roles.some((personRole) => personRole.role === role))
  };
}

function normalizeEnum(value, allowed, field) {
  const normalized = String(value || "").trim().toUpperCase();
  const aliases = { PASSPORT: "PASAPORTE" };
  const finalValue = aliases[normalized] || normalized;

  if (!allowed.includes(finalValue)) {
    throw badRequest(`${field} invalido`);
  }

  return finalValue;
}

function normalizeRoles(value) {
  if (!Array.isArray(value) || !value.length) {
    throw badRequest("Selecciona al menos un rol para la persona");
  }

  const roles = [...new Set(value.map((role) => normalizeEnum(role, ROLES, "Rol")))];

  if (!roles.length) {
    throw badRequest("Selecciona al menos un rol para la persona");
  }

  return roles;
}

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizeOptionalText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeActivo(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() !== "false";
}

function validateEmail(email) {
  if (!email) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("El formato del email no es valido");
  }
}

async function resolveCompany(user, companyId) {
  const filters = [{ tenantId: user.tenantId, status: "ACTIVE" }];

  if (companyId) {
    filters.push({ id: companyId });
  }

  if (user.companyIds.length) {
    filters.push({ id: { in: user.companyIds } });
  }

  const company = await prisma.company.findFirst({
    where: { AND: filters },
    orderBy: { createdAt: "asc" }
  });

  if (!company) {
    throw notFound("Empresa no encontrada para registrar personas");
  }

  return company;
}

function scopedPersonWhere(user, where = {}) {
  const filters = [{ tenantId: user.tenantId }, where];

  if (user.companyIds.length) {
    filters.push({ companyId: { in: user.companyIds } });
  }

  return { AND: filters };
}

async function ensurePerson(user, id) {
  const person = await prisma.person.findFirst({
    where: scopedPersonWhere(user, { id }),
    select: personSelect()
  });

  if (!person) {
    throw notFound("Persona no encontrada");
  }

  return person;
}

async function ensureUniqueIdentification(tenantId, identificacion, excludeId) {
  const duplicated = await prisma.person.findFirst({
    where: {
      tenantId,
      identificacion,
      ...(excludeId ? { NOT: { id: excludeId } } : {})
    },
    select: { id: true }
  });

  if (duplicated) {
    throw badRequest("Ya existe una persona con esa identificacion");
  }
}

async function buildPersonPayload(user, body, options = {}) {
  const data = {};

  if (!options.partial || body.tipoPersona !== undefined) {
    if (!normalizeText(body.tipoPersona)) {
      throw badRequest("El tipo de persona es requerido");
    }
    data.tipoPersona = normalizeEnum(body.tipoPersona, TIPO_PERSONA, "Tipo de persona");
  }

  if (!options.partial || body.tipoIdentificacion !== undefined) {
    if (!normalizeText(body.tipoIdentificacion)) {
      throw badRequest("El tipo de identificacion es requerido");
    }
    data.tipoIdentificacion = normalizeEnum(
      body.tipoIdentificacion,
      TIPO_IDENTIFICACION,
      "Tipo de identificacion"
    );
  }

  if (!options.partial || body.identificacion !== undefined) {
    data.identificacion = normalizeText(body.identificacion);
    if (!data.identificacion) {
      throw badRequest("La identificacion es requerida");
    }
  }

  if (!options.partial || body.nombre !== undefined) {
    data.nombre = normalizeText(body.nombre);
    if (!data.nombre) {
      throw badRequest("El nombre es requerido");
    }
  }

  if (body.telefono !== undefined) data.telefono = normalizeOptionalText(body.telefono);
  if (body.email !== undefined) data.email = normalizeOptionalText(body.email);
  if (body.direccion !== undefined) data.direccion = normalizeOptionalText(body.direccion);
  if (body.activo !== undefined || !options.partial) data.activo = normalizeActivo(body.activo);

  validateEmail(data.email);

  if (!options.partial) {
    const company = await resolveCompany(user, body.companyId);
    data.tenantId = user.tenantId;
    data.companyId = company.id;
    data.createdBy = user.id;
  }

  return data;
}

async function listPeople(user, search) {
  const term = normalizeText(search);
  const searchWhere = term
    ? {
        OR: [
          { identificacion: { contains: term, mode: "insensitive" } },
          { nombre: { contains: term, mode: "insensitive" } },
          { telefono: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } }
        ]
      }
    : {};

  const people = await prisma.person.findMany({
    where: scopedPersonWhere(user, searchWhere),
    select: personSelect(),
    orderBy: [{ updatedAt: "desc" }, { nombre: "asc" }]
  });

  return people.map(formatPerson);
}

async function getPerson(user, id) {
  return formatPerson(await ensurePerson(user, id));
}

async function createPerson(user, body) {
  const data = await buildPersonPayload(user, body);
  const roles = normalizeRoles(body.roles);
  await ensureUniqueIdentification(user.tenantId, data.identificacion);

  try {
    const person = await prisma.person.create({
      data: {
        ...data,
        roles: {
          createMany: {
            data: roles.map((role) => ({ role }))
          }
        }
      },
      select: personSelect()
    });

    return formatPerson(person);
  } catch (error) {
    if (error.code === "P2002") {
      throw badRequest("Ya existe una persona con esa identificacion");
    }
    throw error;
  }
}

async function updatePerson(user, id, body) {
  await ensurePerson(user, id);
  const data = await buildPersonPayload(user, body, { partial: true });
  const roles = body.roles !== undefined ? normalizeRoles(body.roles) : null;

  if (data.identificacion) {
    await ensureUniqueIdentification(user.tenantId, data.identificacion, id);
  }

  try {
    const person = await prisma.$transaction(async (tx) => {
      await tx.person.update({
        where: { id },
        data
      });

      if (roles) {
        await tx.personRole.deleteMany({ where: { personId: id } });
        await tx.personRole.createMany({
          data: roles.map((role) => ({ personId: id, role })),
          skipDuplicates: true
        });
      }

      return tx.person.findFirst({
        where: { id, tenantId: user.tenantId },
        select: personSelect()
      });
    });

    return formatPerson(person);
  } catch (error) {
    if (error.code === "P2002") {
      throw badRequest("Ya existe una persona con esa identificacion");
    }
    throw error;
  }
}

async function setPersonActive(user, id, activo) {
  await ensurePerson(user, id);

  const person = await prisma.person.update({
    where: { id },
    data: { activo: normalizeActivo(activo) },
    select: personSelect()
  });

  return formatPerson(person);
}

module.exports = {
  ROLES,
  listPeople,
  getPerson,
  createPerson,
  updatePerson,
  setPersonActive
};
