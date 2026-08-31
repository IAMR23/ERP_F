const { prisma } = require("../config/db");

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

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

function paymentMethodSelect() {
  return {
    id: true,
    tenantId: true,
    code: true,
    name: true,
    status: true,
    createdAt: true,
    updatedAt: true
  };
}

async function listPaymentMethods(tenantId) {
  return prisma.paymentMethod.findMany({
    where: { tenantId },
    select: paymentMethodSelect(),
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
}

async function getPaymentMethod(tenantId, id) {
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { id, tenantId },
    select: paymentMethodSelect()
  });

  if (!paymentMethod) {
    throw notFound("Forma de pago no encontrada");
  }

  return paymentMethod;
}

function buildPaymentMethodPayload(body = {}, options = {}) {
  const data = {};

  if (!options.partial && !normalizeCode(body.code)) {
    throw badRequest("El codigo de la forma de pago es requerido");
  }

  if (!options.partial && !String(body.name || "").trim()) {
    throw badRequest("El nombre de la forma de pago es requerido");
  }

  if (body.code !== undefined) {
    const code = normalizeCode(body.code);

    if (!code) {
      throw badRequest("El codigo de la forma de pago es requerido");
    }

    data.code = code;
  }

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();

    if (!name) {
      throw badRequest("El nombre de la forma de pago es requerido");
    }

    data.name = name;
  }

  if (body.status !== undefined) {
    data.status = normalizeStatus(body.status);
  }

  return data;
}

async function createPaymentMethod(tenantId, body) {
  const payload = buildPaymentMethodPayload(body);

  try {
    return await prisma.paymentMethod.create({
      data: {
        tenantId,
        status: "ACTIVE",
        ...payload
      },
      select: paymentMethodSelect()
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw badRequest("Ya existe una forma de pago con ese codigo");
    }

    throw error;
  }
}

async function updatePaymentMethod(tenantId, id, body) {
  await getPaymentMethod(tenantId, id);
  const payload = buildPaymentMethodPayload(body, { partial: true });

  try {
    return await prisma.paymentMethod.update({
      where: { id },
      data: payload,
      select: paymentMethodSelect()
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw badRequest("Ya existe una forma de pago con ese codigo");
    }

    throw error;
  }
}

async function disablePaymentMethod(tenantId, id) {
  await getPaymentMethod(tenantId, id);

  return prisma.paymentMethod.update({
    where: { id },
    data: { status: "INACTIVE" },
    select: paymentMethodSelect()
  });
}

module.exports = {
  listPaymentMethods,
  getPaymentMethod,
  createPaymentMethod,
  updatePaymentMethod,
  disablePaymentMethod
};
