const { prisma } = require("../config/db");
const env = require("../config/env");
const crypto = require("crypto");
const path = require("path");
const { readStoredFile } = require("./imageService");
const { buildSriInvoiceXml } = require("./sriInvoiceXmlService");
const { signSriInvoiceXml } = require("./sriSignatureService");
const { queryAuthorization, sendDocument } = require("./sriSoapClient");
const { validateInvoiceXml } = require("./sriXsdValidationService");
const { buildRidePdf, documentParts } = require("./ridePdfService");
const { assertAuthorizedForEmail, deliverInvoiceEmail } = require("./invoiceEmailService");

const DOCUMENT_TYPES = ["INVOICE", "CREDIT_NOTE", "SALES_NOTE", "PROFORMA"];
const SALE_STATUSES = ["PENDING_DELIVERY", "CONFIRMED", "VOIDED"];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function badRequestWithDetails(message, details) {
  const error = badRequest(message);
  error.details = details;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function decimal(value, field, options = {}) {
  const number = Number(value);

  if (!Number.isFinite(number) || (options.positive ? number <= 0 : number < 0)) {
    throw badRequest(`${field} debe ser ${options.positive ? "mayor a 0" : "mayor o igual a 0"}`);
  }

  return number;
}

function decimalString(value, scale = 6) {
  return Number(value || 0).toFixed(scale);
}

function parseDate(value, field, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} invalida`);
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function scopedSaleWhere(user, where = {}) {
  const filters = [{ tenantId: user.tenantId }, where];

  if (user.companyIds.length) {
    filters.push({ companyId: { in: user.companyIds } });
  }

  if (user.branchIds.length) {
    filters.push({ branchId: { in: user.branchIds } });
  }

  return { AND: filters };
}

function scopedWarehouseWhere(user, where = {}) {
  const filters = [{ tenantId: user.tenantId }, where];

  if (user.companyIds.length) {
    filters.push({ companyId: { in: user.companyIds } });
  }

  if (user.branchIds.length) {
    filters.push({ branchId: { in: user.branchIds } });
  }

  return { AND: filters };
}

function documentSelect(options = {}) {
  const includeXml = Boolean(options.includeXml);
  const includeCompanySignature = Boolean(options.includeCompanySignature);

  return {
    id: true,
    tenantId: true,
    companyId: true,
    branchId: true,
    warehouseId: true,
    customerId: true,
    documentType: true,
    status: true,
    issueDate: true,
    dueDate: true,
    establishmentCode: true,
    emissionPoint: true,
    sequential: true,
    documentNumber: true,
    purchaseOrder: true,
    reference: true,
    description: true,
    subtotal: true,
    discountTotal: true,
    taxableSubtotal: true,
    taxTotal: true,
    total: true,
    sriStatus: true,
    sriAccessKey: true,
    sriUnsignedXml: includeXml,
    sriXml: includeXml,
    sriGeneratedAt: true,
    sriSignedAt: true,
    sriSignatureError: true,
    sriSentAt: true,
    sriReceptionError: true,
    sriAuthorizationNumber: true,
    sriAuthorizationDate: true,
    sriAuthorizationError: true,
    sriReceptionResponse: includeXml,
    sriAuthorizationXml: includeXml,
    sriMessages: true,
    sriError: true,
    customerEmailSentAt: true,
    customerEmailLastSentAt: true,
    customerEmailLastAttemptAt: true,
    customerEmailSendingAt: true,
    customerEmailRecipient: true,
    customerEmailError: true,
    customerEmailAttemptCount: true,
    correlationId: true,
    createdAt: true,
    company: {
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        ruc: true,
        mainAddress: true,
        email: true,
        phone: true,
        logoObjectKey: true,
        accountingRequired: true,
        sriEnvironment: true,
        ...(includeCompanySignature ? { proformaSignatureKey: true } : {}),
        currency: true,
        specialContributor: true,
        specialContributorResolution: true,
        largeTaxpayer: true,
        largeTaxpayerResolution: true,
        rimpe: true,
        withholdingAgent: true,
        withholdingAgentResolution: true,
        sriSoftwareProviderRuc: true
      }
    },
    branch: { select: { id: true, code: true, name: true, address: true } },
    warehouse: { select: { id: true, code: true, name: true } },
    customer: {
      select: {
        id: true,
        tipoIdentificacion: true,
        identificacion: true,
        nombre: true,
        email: true,
        telefono: true,
        direccion: true
      }
    },
    payments: {
      select: {
        id: true,
        amount: true,
        reference: true,
        paymentMethod: { select: { id: true, code: true, name: true, status: true } }
      }
    },
    lines: {
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        unit: true,
        discountRate: true,
        discountAmount: true,
        netSubtotal: true,
        taxRatePercent: true,
        taxAmount: true,
        lineTotal: true,
        incomeTaxRetention: true,
        ivaRetention: true,
        stockUnitCost: true,
        catalogItem: { select: { id: true, internalCode: true, name: true, description: true } }
      },
      orderBy: { id: "asc" }
    }
  };
}

function mapDocument(document) {
  const retentionTotal = document.lines.reduce(
    (sum, line) => sum + Number(line.incomeTaxRetention || 0) + Number(line.ivaRetention || 0),
    0
  );

  const electronicMilestones = calculateElectronicMilestones(document);

  return {
    ...document,
    subtotal: Number(document.subtotal),
    discountTotal: Number(document.discountTotal),
    taxableSubtotal: Number(document.taxableSubtotal),
    taxTotal: Number(document.taxTotal),
    total: Number(document.total),
    retentionTotal,
    balance: document.status === "VOIDED" ? 0 : Math.max(0, Number(document.total) - retentionTotal),
    sriReview: {
      status: document.sriStatus,
      accessKey: document.sriAccessKey,
      generatedAt: document.sriGeneratedAt,
      signedAt: document.sriSignedAt,
      sentAt: document.sriSentAt,
      authorizationNumber: document.sriAuthorizationNumber,
      authorizationDate: document.sriAuthorizationDate,
      error: document.sriError,
      messages: document.sriMessages || [],
      hasXml: Boolean(document.sriXml || document.sriAccessKey),
      productCount: document.lines.length,
      total: Number(document.total),
      retentionTotal
    },
    electronicMilestones,
    payments: document.payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount)
    })),
    lines: document.lines.map((line) => ({
      ...line,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountRate: Number(line.discountRate),
      discountAmount: Number(line.discountAmount),
      netSubtotal: Number(line.netSubtotal),
      taxRatePercent: Number(line.taxRatePercent),
      taxAmount: Number(line.taxAmount),
      lineTotal: Number(line.lineTotal),
      incomeTaxRetention: Number(line.incomeTaxRetention),
      ivaRetention: Number(line.ivaRetention),
      stockUnitCost: Number(line.stockUnitCost)
    }))
  };
}

function milestone(state, date = null, error = null) {
  return { state, date, error };
}

function calculateElectronicMilestones(document) {
  if (document?.documentType !== "INVOICE") {
    return {
      signed: milestone("NOT_APPLICABLE"),
      received: milestone("NOT_APPLICABLE"),
      authorized: milestone("NOT_APPLICABLE"),
      emailed: milestone("NOT_APPLICABLE")
    };
  }

  const authorized =
    document.sriStatus === "AUTHORIZED" &&
    Boolean(document.sriAuthorizationNumber) &&
    Boolean(document.sriAuthorizationDate);

  return {
    signed: document.sriSignedAt
      ? milestone("COMPLETED", document.sriSignedAt)
      : document.sriSignatureError
        ? milestone("ERROR", null, document.sriSignatureError)
        : milestone("PENDING"),
    received: document.sriSentAt
      ? milestone("COMPLETED", document.sriSentAt)
      : document.sriReceptionError
        ? milestone("ERROR", null, document.sriReceptionError)
        : milestone("PENDING"),
    authorized: authorized
      ? milestone("COMPLETED", document.sriAuthorizationDate)
      : document.sriAuthorizationError
        ? milestone("ERROR", null, document.sriAuthorizationError)
        : milestone("PENDING"),
    emailed: document.customerEmailSentAt
      ? milestone("COMPLETED", document.customerEmailSentAt)
      : document.customerEmailError
        ? milestone("ERROR", null, document.customerEmailError)
        : milestone("PENDING")
  };
}

function normalizeDocumentType(documentType) {
  const normalized = String(documentType || "INVOICE").trim().toUpperCase();

  if (!DOCUMENT_TYPES.includes(normalized)) {
    throw badRequest("Tipo de documento invalido");
  }

  return normalized;
}

async function ensureWarehouse(user, warehouseId) {
  const warehouse = await prisma.warehouse.findFirst({
    where: scopedWarehouseWhere(user, { id: warehouseId, status: "ACTIVE" }),
    include: {
      branch: { select: { sriEstablishmentCode: true } }
    }
  });

  if (!warehouse) {
    throw notFound("Bodega no encontrada");
  }

  return warehouse;
}

function sriCode(value, fallback = "001") {
  return String(value || fallback).trim().padStart(3, "0");
}

function resolveSriNumbering(body, warehouse) {
  const branchEmissionPoint = sriCode(warehouse.branch?.sriEstablishmentCode);
  const requestedEstablishment = sriCode(body.establishmentCode);
  const requestedEmissionPoint = sriCode(body.emissionPoint, branchEmissionPoint);

  if (
    branchEmissionPoint !== "001" &&
    requestedEstablishment === branchEmissionPoint &&
    requestedEmissionPoint === "001"
  ) {
    return {
      establishmentCode: "001",
      emissionPoint: branchEmissionPoint
    };
  }

  return {
    establishmentCode: requestedEstablishment,
    emissionPoint: requestedEmissionPoint
  };
}

async function ensureCustomer(user, customerId, companyId) {
  const customer = await prisma.person.findFirst({
    where: {
      tenantId: user.tenantId,
      companyId,
      id: customerId,
      activo: true,
      roles: { some: { role: "CLIENTE" } }
    }
  });

  if (!customer) {
    throw notFound("Cliente no encontrado");
  }

  return customer;
}

async function ensurePaymentMethod(tenantId, paymentMethodId) {
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { tenantId, id: paymentMethodId }
  });

  if (!paymentMethod) {
    throw notFound("Forma de pago no encontrada");
  }

  return paymentMethod;
}

async function getNextDocumentNumber(tx, sale) {
  const sequence = await tx.saleDocumentSequence.upsert({
    where: {
      tenantId_companyId_documentType_establishmentCode_emissionPoint: {
        tenantId: sale.tenantId,
        companyId: sale.companyId,
        documentType: sale.documentType,
        establishmentCode: sale.establishmentCode,
        emissionPoint: sale.emissionPoint
      }
    },
    update: { currentNumber: { increment: 1 } },
    create: {
      tenantId: sale.tenantId,
      companyId: sale.companyId,
      documentType: sale.documentType,
      establishmentCode: sale.establishmentCode,
      emissionPoint: sale.emissionPoint,
      currentNumber: 1
    }
  });

  return {
    sequential: sequence.currentNumber,
    documentNumber: `${sale.establishmentCode}-${sale.emissionPoint}-${String(
      sequence.currentNumber
    ).padStart(9, "0")}`
  };
}

function normalizeRequestedDocumentNumber(value, establishmentCode, emissionPoint) {
  const documentNumber = String(value || "").trim();

  if (!documentNumber) {
    return null;
  }

  const match = documentNumber.match(/^(\d{3})-(\d{3})-(\d{9})$/);

  if (!match) {
    throw badRequest("El número de documento debe tener el formato 001-001-000000001");
  }

  if (match[1] !== establishmentCode || match[2] !== emissionPoint) {
    throw badRequest(
      `El número de documento debe iniciar con ${establishmentCode}-${emissionPoint}`
    );
  }

  const sequential = Number(match[3]);

  if (!Number.isInteger(sequential) || sequential < 1) {
    throw badRequest("El secuencial del documento debe ser mayor a cero");
  }

  return { documentNumber, sequential };
}

async function reserveDocumentNumber(tx, sale, requestedNumber) {
  if (!requestedNumber) {
    return getNextDocumentNumber(tx, sale);
  }

  const duplicated = await tx.sale.findFirst({
    where: {
      tenantId: sale.tenantId,
      companyId: sale.companyId,
      documentType: sale.documentType,
      documentNumber: requestedNumber.documentNumber
    },
    select: { id: true }
  });

  if (duplicated) {
    throw badRequest(
      `Número de documento repetido: ${requestedNumber.documentNumber}. Este documento no puede volver a enviarse.`
    );
  }

  const sequenceWhere = {
    tenantId_companyId_documentType_establishmentCode_emissionPoint: {
      tenantId: sale.tenantId,
      companyId: sale.companyId,
      documentType: sale.documentType,
      establishmentCode: sale.establishmentCode,
      emissionPoint: sale.emissionPoint
    }
  };
  const sequence = await tx.saleDocumentSequence.upsert({
    where: sequenceWhere,
    update: {},
    create: {
      tenantId: sale.tenantId,
      companyId: sale.companyId,
      documentType: sale.documentType,
      establishmentCode: sale.establishmentCode,
      emissionPoint: sale.emissionPoint,
      currentNumber: requestedNumber.sequential
    }
  });

  if (sequence.currentNumber < requestedNumber.sequential) {
    await tx.saleDocumentSequence.updateMany({
      where: {
        id: sequence.id,
        currentNumber: { lt: requestedNumber.sequential }
      },
      data: { currentNumber: requestedNumber.sequential }
    });
  }

  return requestedNumber;
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    throw badRequest("Agrega al menos un producto al documento");
  }

  return lines.map((line, index) => {
    if (!line.catalogItemId) {
      throw badRequest(`Producto requerido en la linea ${index + 1}`);
    }

    const quantity = decimal(line.quantity, `Cantidad de la linea ${index + 1}`, { positive: true });
    const unitPrice = decimal(line.unitPrice, `Precio de la linea ${index + 1}`);
    const discountAmount = Math.min(
      quantity * unitPrice,
      decimal(line.discountAmount || 0, `Descuento de la linea ${index + 1}`)
    );
    const taxRatePercent = decimal(line.taxRatePercent || 0, `IVA de la linea ${index + 1}`);
    const incomeTaxRetention = decimal(
      line.incomeTaxRetention || 0,
      `Retencion IR de la linea ${index + 1}`
    );
    const ivaRetention = decimal(line.ivaRetention || 0, `Retencion IVA de la linea ${index + 1}`);
    const netSubtotal = Math.max(0, quantity * unitPrice - discountAmount);
    const taxAmount = netSubtotal * (taxRatePercent / 100);

    return {
      catalogItemId: line.catalogItemId,
      quantity,
      unitPrice,
      unit: String(line.unit || "Unidad").trim() || "Unidad",
      discountAmount,
      taxRatePercent,
      netSubtotal,
      taxAmount,
      lineTotal: netSubtotal + taxAmount,
      incomeTaxRetention,
      ivaRetention
    };
  });
}

function normalizeCreditNoteReason(value) {
  const reason = String(value || "").trim();

  if (!reason) {
    throw badRequest("Ingrese el motivo de la nota de credito");
  }

  return reason;
}

function normalizeDocumentNumber(value) {
  const documentNumber = String(value || "").trim();

  if (!documentNumber) {
    throw badRequest("Ingrese el numero de factura");
  }

  return documentNumber;
}

function sumQuantitiesByProduct(documents) {
  return documents.reduce((acc, document) => {
    document.lines.forEach((line) => {
      const current = acc.get(line.catalogItemId) || 0;
      acc.set(line.catalogItemId, current + Number(line.quantity));
    });

    return acc;
  }, new Map());
}

function allocateRemainingInvoiceLines(invoice, creditedByProduct) {
  const usedByProduct = new Map();

  return invoice.lines
    .map((line) => {
      const alreadyCredited = creditedByProduct.get(line.catalogItem.id) || 0;
      const consumed = usedByProduct.get(line.catalogItem.id) || 0;
      const lineQuantity = Number(line.quantity);
      const consumedInLine = Math.min(lineQuantity, Math.max(0, alreadyCredited - consumed));
      const remainingQuantity = Math.max(0, lineQuantity - consumedInLine);

      usedByProduct.set(line.catalogItem.id, consumed + lineQuantity);

      return {
        sourceLineId: line.id,
        remainingQuantity,
        line
      };
    })
    .filter((item) => item.remainingQuantity > 0);
}

function creditNoteLineFromInvoiceLine(invoiceLine, quantity) {
  const originalQuantity = Number(invoiceLine.quantity);
  const ratio = originalQuantity > 0 ? quantity / originalQuantity : 0;
  const unitPrice = Number(invoiceLine.unitPrice);
  const discountAmount = Number(invoiceLine.discountAmount || 0) * ratio;
  const taxRatePercent = Number(invoiceLine.taxRatePercent || 0);
  const netSubtotal = Math.max(0, quantity * unitPrice - discountAmount);
  const taxAmount = netSubtotal * (taxRatePercent / 100);

  return {
    sourceLineId: invoiceLine.id,
    catalogItemId: invoiceLine.catalogItem.id,
    quantity,
    unitPrice,
    unit: invoiceLine.unit || "Unidad",
    discountAmount,
    taxRatePercent,
    netSubtotal,
    taxAmount,
    lineTotal: netSubtotal + taxAmount,
    incomeTaxRetention: Number(invoiceLine.incomeTaxRetention || 0) * ratio,
    ivaRetention: Number(invoiceLine.ivaRetention || 0) * ratio,
    stockUnitCost: Number(invoiceLine.stockUnitCost || 0)
  };
}

function normalizeCreditNoteLines(invoice, requestedLines, creditedByProduct) {
  const remainingLines = allocateRemainingInvoiceLines(invoice, creditedByProduct);

  if (!remainingLines.length) {
    throw badRequest("La factura seleccionada ya no tiene productos pendientes para nota de credito");
  }

  if (!Array.isArray(requestedLines) || !requestedLines.length) {
    return remainingLines.map(({ line, remainingQuantity }) =>
      creditNoteLineFromInvoiceLine(line, remainingQuantity)
    );
  }

  const remainingBySourceLineId = new Map(remainingLines.map((item) => [item.sourceLineId, item]));
  const usedBySourceLineId = new Map();

  return requestedLines.map((requestedLine, index) => {
    const sourceLineId = String(
      requestedLine.sourceLineId || requestedLine.saleLineId || requestedLine.id || ""
    ).trim();

    if (!sourceLineId) {
      throw badRequest(`Linea de factura requerida en la linea ${index + 1}`);
    }

    const remaining = remainingBySourceLineId.get(sourceLineId);

    if (!remaining) {
      throw badRequest(`La linea ${index + 1} no pertenece a la factura o ya fue acreditada`);
    }

    const quantity = decimal(requestedLine.quantity, `Cantidad de la linea ${index + 1}`, {
      positive: true
    });
    const alreadyUsed = usedBySourceLineId.get(sourceLineId) || 0;

    if (alreadyUsed + quantity > remaining.remainingQuantity) {
      throw badRequest(
        `La cantidad de la linea ${index + 1} supera lo pendiente de la factura`
      );
    }

    usedBySourceLineId.set(sourceLineId, alreadyUsed + quantity);
    return creditNoteLineFromInvoiceLine(remaining.line, quantity);
  });
}

async function getCreditNoteInvoice(user, documentNumber) {
  const invoice = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, {
      documentType: "INVOICE",
      status: "CONFIRMED",
      documentNumber
    }),
    select: documentSelect()
  });

  if (!invoice) {
    throw notFound("Factura no encontrada o no disponible para nota de credito");
  }

  return invoice;
}

async function getCreditedQuantities(user, invoice) {
  const creditNotes = await prisma.sale.findMany({
    where: scopedSaleWhere(user, {
      companyId: invoice.companyId,
      documentType: "CREDIT_NOTE",
      status: "CONFIRMED",
      reference: invoice.documentNumber
    }),
    select: {
      lines: {
        select: {
          catalogItemId: true,
          quantity: true
        }
      }
    }
  });

  return sumQuantitiesByProduct(creditNotes);
}

function mapCreditNoteDraft(invoice, reason, creditedByProduct) {
  const remainingLines = allocateRemainingInvoiceLines(invoice, creditedByProduct);

  return {
    invoice: mapDocument(invoice),
    reason,
    lines: remainingLines.map(({ sourceLineId, remainingQuantity, line }) => ({
      sourceLineId,
      catalogItemId: line.catalogItem.id,
      product: line.catalogItem,
      quantity: remainingQuantity,
      unit: line.unit || "Unidad",
      unitPrice: Number(line.unitPrice),
      discountAmount: Number(line.discountAmount),
      taxRatePercent: Number(line.taxRatePercent),
      incomeTaxRetention: Number(line.incomeTaxRetention),
      ivaRetention: Number(line.ivaRetention),
      stockUnitCost: Number(line.stockUnitCost),
      lineTotal: Number(line.lineTotal)
    }))
  };
}

async function validateCreditNoteInvoice(user, body = {}) {
  const documentNumber = normalizeDocumentNumber(body.documentNumber || body.invoiceNumber);
  const reason = normalizeCreditNoteReason(body.reason || body.motive || body.description);
  const invoice = await getCreditNoteInvoice(user, documentNumber);
  const creditedByProduct = await getCreditedQuantities(user, invoice);
  const draft = mapCreditNoteDraft(invoice, reason, creditedByProduct);

  if (!draft.lines.length) {
    throw badRequest("La factura seleccionada ya fue acreditada por completo");
  }

  return draft;
}

async function applySaleInventoryMovements(tx, user, warehouse, sale, lines, productById) {
  for (const [index, line] of lines.entries()) {
    const product = productById.get(line.catalogItemId);
    const balance = await tx.stockBalance.findUnique({
      where: {
        tenantId_warehouseId_catalogItemId: {
          tenantId: user.tenantId,
          warehouseId: warehouse.id,
          catalogItemId: line.catalogItemId
        }
      }
    });

    const previousOnHand = balance ? Number(balance.onHand) : 0;
    const available = balance ? Math.max(0, Number(balance.onHand) - Number(balance.reserved)) : 0;

    if (!balance || available < line.quantity) {
      throw badRequest(
        `Stock insuficiente para ${product?.internalCode || ""} - ${
          product?.name || "producto"
        }. Disponible: ${decimalString(available, 4)}`
      );
    }

    const unitCost = Number(balance.averageCost || 0);
    const totalCost = line.quantity * unitCost;
    await tx.saleLine.updateMany({
      where: {
        saleId: sale.id,
        catalogItemId: line.catalogItemId
      },
      data: {
        stockUnitCost: decimalString(unitCost)
      }
    });

    const stockUpdate = await tx.stockBalance.updateMany({
      where: {
        id: balance.id,
        onHand: { gte: decimalString(line.quantity, 4) }
      },
      data: {
        onHand: { decrement: decimalString(line.quantity, 4) },
        version: { increment: 1 }
      }
    });

    if (stockUpdate.count !== 1) {
      throw badRequest(`Stock insuficiente para ${product?.internalCode || product?.name || "producto"}`);
    }

    await tx.inventoryMovement.create({
      data: {
        tenantId: user.tenantId,
        companyId: warehouse.companyId,
        branchId: warehouse.branchId,
        warehouseId: warehouse.id,
        catalogItemId: line.catalogItemId,
        type: "SALE_OUT",
        quantityIn: "0.0000",
        quantityOut: decimalString(line.quantity, 4),
        previousOnHand: decimalString(previousOnHand, 4),
        nextOnHand: decimalString(previousOnHand - line.quantity, 4),
        unitCost: decimalString(unitCost),
        totalCost: decimalString(totalCost),
        sourceType: "SALE",
        sourceId: sale.id,
        reference: sale.documentNumber || sale.reference || null,
        correlationId: sale.correlationId,
        idempotencyKey: `${sale.id}:${line.catalogItemId}:sale-out:${index}`,
        responsibleUserId: user.id,
        effectiveAt: sale.issueDate
      }
    });
  }
}

async function applyCreditNoteInventoryMovements(tx, user, warehouse, sale, lines) {
  for (const [index, line] of lines.entries()) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        tenantId_warehouseId_catalogItemId: {
          tenantId: user.tenantId,
          warehouseId: warehouse.id,
          catalogItemId: line.catalogItemId
        }
      }
    });
    const unitCost = Number(line.stockUnitCost || 0);
    const totalCost = line.quantity * unitCost;
    const previousOnHand = balance ? Number(balance.onHand) : 0;
    const previousAverageCost = balance ? Number(balance.averageCost) : 0;
    const nextOnHand = previousOnHand + line.quantity;
    const nextAverageCost =
      nextOnHand > 0
        ? (previousOnHand * previousAverageCost + totalCost) / nextOnHand
        : unitCost;

    if (balance) {
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          onHand: decimalString(nextOnHand, 4),
          averageCost: decimalString(nextAverageCost),
          version: { increment: 1 }
        }
      });
    } else {
      await tx.stockBalance.create({
        data: {
          tenantId: user.tenantId,
          companyId: warehouse.companyId,
          branchId: warehouse.branchId,
          warehouseId: warehouse.id,
          catalogItemId: line.catalogItemId,
          onHand: decimalString(nextOnHand, 4),
          averageCost: decimalString(nextAverageCost)
        }
      });
    }

    await tx.inventoryMovement.create({
      data: {
        tenantId: user.tenantId,
        companyId: warehouse.companyId,
        branchId: warehouse.branchId,
        warehouseId: warehouse.id,
        catalogItemId: line.catalogItemId,
        type: "CREDIT_NOTE_IN",
        quantityIn: decimalString(line.quantity, 4),
        quantityOut: "0.0000",
        previousOnHand: decimalString(previousOnHand, 4),
        nextOnHand: decimalString(nextOnHand, 4),
        unitCost: decimalString(unitCost),
        totalCost: decimalString(totalCost),
        sourceType: "SALE",
        sourceId: sale.id,
        reference: sale.reference || sale.documentNumber || null,
        correlationId: sale.correlationId,
        idempotencyKey: `${sale.id}:${line.catalogItemId}:credit-note-in:${index}`,
        responsibleUserId: user.id,
        effectiveAt: sale.issueDate
      }
    });
  }
}

async function listDocuments(user, filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(filters.pageSize) || 25));
  const fromDate = parseDate(filters.fromDate, "Fecha desde");
  const toDate = parseDate(filters.toDate, "Fecha hasta", true);
  const documentType = filters.documentType ? normalizeDocumentType(filters.documentType) : null;
  const status = filters.status ? String(filters.status).trim().toUpperCase() : "";
  const search = String(filters.person || "").trim();
  const documentNumber = String(filters.documentNumber || "").trim();

  if (status && !SALE_STATUSES.includes(status)) {
    throw badRequest("Estado invalido");
  }

  const where = {
    ...(documentType ? { documentType } : { documentType: { in: ["INVOICE", "CREDIT_NOTE", "SALES_NOTE"] } }),
    ...(status ? { status } : {}),
    ...(documentNumber ? { documentNumber: { contains: documentNumber, mode: "insensitive" } } : {}),
    ...(fromDate || toDate
      ? {
          issueDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {})
          }
        }
      : {}),
    ...(search
      ? {
          customer: {
            is: {
              OR: [
                { identificacion: { contains: search, mode: "insensitive" } },
                { nombre: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { telefono: { contains: search, mode: "insensitive" } }
              ]
            }
          }
        }
      : {})
  };

  const [total, documents] = await Promise.all([
    prisma.sale.count({ where: scopedSaleWhere(user, where) }),
    prisma.sale.findMany({
      where: scopedSaleWhere(user, where),
      select: documentSelect(),
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    documents: documents.map(mapDocument),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

async function getDocument(user, id) {
  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect({ includeXml: true })
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  return mapDocument(document);
}

function validateSriCertificateFile(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw badRequest("El archivo .p12 configurado esta vacio o no se pudo leer");
  }
}

async function throwSriSignatureError(document, message) {
  const failed = await prisma.sale.update({
    where: { id: document.id },
    data: { sriSignatureError: message, sriError: message },
    select: documentSelect({ includeXml: true })
  });
  throw badRequestWithDetails(message, { document: mapDocument(failed) });
}

function sriMessagesText(messages = []) {
  if (!Array.isArray(messages) || !messages.length) {
    return null;
  }

  return messages
    .map((message) =>
      [message.identificador, message.mensaje, message.informacionAdicional, message.tipo]
        .filter(Boolean)
        .join(" - ")
    )
    .join("\n");
}

function buildSriSubmission(document, options = {}) {
  const xml = options.xml || document?.sriXml || "";
  const status = options.status || document?.sriStatus || "PENDING";
  const error = options.error || null;

  return {
    status,
    error,
    sentAt: options.sentAt || document?.sriSentAt || null,
    environment: document?.company?.sriEnvironment === "PRODUCTION" ? "Produccion" : "Pruebas",
    documentId: document?.id || null,
    documentNumber: document?.documentNumber || null,
    accessKey: document?.sriAccessKey || null,
    company: document?.company?.tradeName || document?.company?.legalName || null,
    ruc: document?.company?.ruc || null,
    customer: document?.customer?.nombre || null,
    customerIdentification: document?.customer?.identificacion || null,
    productCount: Array.isArray(document?.lines) ? document.lines.length : 0,
    total: Number(document?.total || 0),
    signedXml: xml.includes("<Signature"),
    xmlBytes: Buffer.byteLength(xml, "utf8"),
    messages: options.messages || document?.sriMessages || []
  };
}

async function throwSriSendError(document, message) {
  let failedDocument = null;
  if (document?.id) {
    failedDocument = await prisma.sale
      .update({
        where: { id: document.id },
        data: { sriReceptionError: message, sriError: message },
        select: documentSelect({ includeXml: true })
      })
      .catch(() => null);
  }

  throw badRequestWithDetails(message, {
    document: failedDocument ? mapDocument(failedDocument) : null,
    sriSubmission: buildSriSubmission(failedDocument || document, {
      status: "FAILED",
      error: message
    })
  });
}

async function validateSriDocument(user, id) {
  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect({ includeXml: true, includeCompanySignature: true })
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  if (document.documentType !== "INVOICE") {
    throw badRequest("Solo las facturas se validan para SRI");
  }

  if (document.sriSentAt || document.sriStatus === "AUTHORIZED") {
    throw badRequest("La factura ya fue enviada al SRI y no puede volver a firmarse ni enviarse");
  }

  if (!document.sriXml || !document.sriAccessKey) {
    const regenerated = buildSriInvoiceXml(document);
    validateInvoiceXml(regenerated.xml);
    await prisma.sale.update({
      where: { id: document.id },
      data: {
        sriAccessKey: regenerated.accessKey,
        sriUnsignedXml: regenerated.xml,
        sriXml: regenerated.xml,
        sriGeneratedAt: new Date()
      }
    });
    document.sriXml = regenerated.xml;
    document.sriUnsignedXml = regenerated.xml;
    document.sriAccessKey = regenerated.accessKey;
  }

  if (!document.company?.proformaSignatureKey) {
    await throwSriSignatureError(document, "Cargue el archivo .p12 en la configuracion de la empresa");
  }

  if (path.extname(document.company.proformaSignatureKey).toLowerCase() !== ".p12") {
    await throwSriSignatureError(document, "El archivo configurado para firma debe tener extension .p12");
  }

  if (!env.sriP12Password) {
    await throwSriSignatureError(
      document,
      "Configure SRI_P12_PASSWORD o FirmaPrueba con la contrasena del archivo .p12"
    );
  }

  const certificate = await readStoredFile(document.company.proformaSignatureKey).catch(async () => {
    await throwSriSignatureError(document, "No se encontro el archivo .p12 configurado para la empresa");
  });
  const unsignedXml = document.sriUnsignedXml || document.sriXml;

  let signedXml;

  try {
    validateSriCertificateFile(certificate);
    validateInvoiceXml(unsignedXml);
    signedXml = signSriInvoiceXml(unsignedXml, certificate, env.sriP12Password);
    validateInvoiceXml(signedXml);
  } catch (error) {
    const message = error.message || "No se pudo firmar el XML para SRI";
    await throwSriSignatureError(document, message);
  }

  const signedAt = new Date();
  const updatedDocument = await prisma.sale.update({
    where: { id: document.id },
    data: {
      sriStatus: "READY_TO_SEND",
      sriXml: signedXml,
      sriUnsignedXml: unsignedXml,
      sriSignedAt: signedAt,
      sriSignatureError: null,
      sriReceptionError: null,
      sriAuthorizationError: null,
      sriError: null
    },
    select: documentSelect({ includeXml: true })
  });

  return mapDocument(updatedDocument);
}

async function sendSriDocument(user, id) {
  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect({ includeXml: true })
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  if (document.documentType !== "INVOICE") {
    await throwSriSendError(document, "Solo las facturas se envian al SRI");
  }

  if (document.sriStatus !== "READY_TO_SEND") {
    await throwSriSendError(document, "Valide la factura para SRI antes de enviarla");
  }

  if (!document.sriXml || !document.sriAccessKey) {
    await throwSriSendError(document, "La factura no tiene XML generado para SRI");
  }

  if (!document.sriXml.includes("<ds:Signature") && !document.sriXml.includes("<Signature")) {
    await throwSriSendError(document, "El XML debe estar firmado antes de enviarlo al SRI");
  }

  validateInvoiceXml(document.sriXml);

  let reception;

  try {
    reception = await sendDocument(document.company, document.sriXml);
  } catch (error) {
    await throwSriSendError(document, error.message || "No se pudo enviar el XML al SRI");
  }

  if (reception.estado === "DEVUELTA") {
    const messages = reception.messages || [];
    const errorText = sriMessagesText(messages) || "El SRI devolvio el comprobante";
    const rejectedDocument = await prisma.sale.update({
      where: { id: document.id },
      data: {
        sriStatus: "REJECTED",
        sriReceptionResponse: reception.rawXml || null,
        sriMessages: messages,
        sriReceptionError: errorText,
        sriError: errorText
      },
      select: documentSelect({ includeXml: true })
    });

    return {
      document: mapDocument(rejectedDocument),
      sriSubmission: buildSriSubmission(rejectedDocument, {
        status: "REJECTED",
        error: errorText,
        messages
      })
    };
  }

  if (reception.estado !== "RECIBIDA") {
    const messages = reception.messages || [];
    await throwSriSendError(
      document,
      sriMessagesText(messages) || `Respuesta de recepcion SRI no reconocida: ${reception.estado || "sin estado"}`
    );
  }

  const sentAt = new Date();
  await prisma.sale.update({
    where: { id: document.id },
    data: {
      sriStatus: "SENT",
      sriSentAt: sentAt,
      sriReceptionResponse: reception.rawXml || null,
      sriMessages: reception.messages || [],
      sriReceptionError: null,
      sriError: null
    }
  });

  return consultSriAuthorization(user, id, { sentAt });
}

function parseSriAuthorizationDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function consultSriAuthorization(user, id, options = {}) {
  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect({ includeXml: true })
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  if (document.documentType !== "INVOICE") {
    throw badRequest("Solo las facturas se consultan en el SRI");
  }

  if (!document.sriAccessKey || document.sriAccessKey.length !== 49) {
    throw badRequest("La factura no tiene clave de acceso SRI valida");
  }

  let authorization;

  try {
    authorization = await queryAuthorization(document.company, document.sriAccessKey);
  } catch (error) {
    const message = error.message || "No se pudo consultar la autorizacion en el SRI";
    const failed = await prisma.sale.update({
      where: { id: document.id },
      data: { sriAuthorizationError: message, sriError: message },
      select: documentSelect({ includeXml: true })
    });
    throw badRequestWithDetails(message, {
      document: mapDocument(failed),
      sriSubmission: buildSriSubmission(document, { status: "FAILED", error: message })
    });
  }

  const messages = authorization.messages || [];
  const estado = authorization.estado;
  const authorizationNumber = String(authorization.numeroAutorizacion || "").trim();
  const authorizationDate = parseSriAuthorizationDate(authorization.fechaAutorizacion);
  const authorized = estado === "AUTORIZADO" && Boolean(authorizationNumber) && Boolean(authorizationDate);
  const rejected = estado === "NO AUTORIZADO";
  const nextStatus = authorized ? "AUTHORIZED" : rejected ? "REJECTED" : "PROCESSING";
  const errorText = rejected
    ? sriMessagesText(messages) || "Comprobante no autorizado por el SRI"
    : estado === "AUTORIZADO" && !authorized
      ? "El SRI respondio AUTORIZADO sin numero o fecha de autorizacion"
      : null;
  let updatedDocument = await prisma.sale.update({
    where: { id: document.id },
    data: {
      sriStatus: nextStatus,
      sriAuthorizationNumber: authorized ? authorizationNumber : document.sriAuthorizationNumber,
      sriAuthorizationDate: authorized ? authorizationDate : document.sriAuthorizationDate,
      sriAuthorizationXml: authorization.authorizationXml || document.sriAuthorizationXml,
      sriMessages: messages,
      sriAuthorizationError: errorText,
      sriError: errorText
    },
    select: documentSelect({ includeXml: true })
  });

  if (authorized && !updatedDocument.customerEmailSentAt) {
    try {
      updatedDocument = await sendAuthorizedInvoiceEmail(user, id, { returnRaw: true });
    } catch {
      updatedDocument = await prisma.sale.findFirst({
        where: scopedSaleWhere(user, { id }),
        select: documentSelect({ includeXml: true })
      });
    }
  }

  return {
    document: mapDocument(updatedDocument),
    sriSubmission: buildSriSubmission(updatedDocument, {
      status: nextStatus,
      sentAt: options.sentAt,
      messages,
      error: errorText
    })
  };
}

async function sendAuthorizedInvoiceEmail(user, id, options = {}) {
  const force = Boolean(options.force);
  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect({ includeXml: true })
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  assertAuthorizedForEmail(document);

  assertEmailSendAllowed(document, force);

  const attemptAt = new Date();
  const claim = await prisma.sale.updateMany({
    where: scopedSaleWhere(user, {
      id,
      customerEmailSendingAt: null,
      ...(force ? {} : { customerEmailSentAt: null })
    }),
    data: {
      customerEmailSendingAt: attemptAt,
      customerEmailLastAttemptAt: attemptAt,
      customerEmailAttemptCount: { increment: 1 },
      customerEmailError: null
    }
  });

  if (claim.count !== 1) {
    throw badRequest("El correo ya fue enviado o existe otro envio en curso");
  }

  try {
    const delivery = await deliverInvoiceEmail(document);
    const sentAt = new Date();
    const updated = await prisma.sale.update({
      where: { id },
      data: {
        customerEmailSentAt: document.customerEmailSentAt || sentAt,
        customerEmailLastSentAt: sentAt,
        customerEmailRecipient: delivery.recipient,
        customerEmailError: null,
        customerEmailSendingAt: null
      },
      select: documentSelect({ includeXml: true })
    });
    return options.returnRaw ? updated : mapDocument(updated);
  } catch (error) {
    const message = error.message || "No se pudo enviar la factura por correo";
    const failed = await prisma.sale.update({
      where: { id },
      data: {
        customerEmailRecipient: document.customer?.email || null,
        customerEmailError: message,
        customerEmailSendingAt: null
      },
      select: documentSelect({ includeXml: true })
    });
    throw badRequestWithDetails(message, { document: mapDocument(failed) });
  }
}

function assertEmailSendAllowed(document, force = false) {
  assertAuthorizedForEmail(document);
  if (document.customerEmailSentAt && !force) {
    throw badRequest("La factura ya fue enviada al cliente. Use la accion Reenviar correo.");
  }
}

async function updateDocumentWarehouse(user, id, warehouseId) {
  if (!warehouseId) {
    throw badRequest("Seleccione una bodega");
  }

  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect()
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  if (document.documentType !== "INVOICE") {
    throw badRequest("La bodega solo se puede cambiar en facturas");
  }

  if (document.status === "VOIDED") {
    throw badRequest("No se puede cambiar la bodega de un documento anulado");
  }

  const warehouse = await ensureWarehouse(user, warehouseId);

  if (warehouse.companyId !== document.companyId || warehouse.branchId !== document.branchId) {
    throw badRequest("La nueva bodega debe pertenecer a la misma empresa y sucursal del documento");
  }

  if (warehouse.id === document.warehouseId) {
    return document;
  }

  const quantities = new Map();
  document.lines.forEach((line) => {
    const itemId = line.catalogItem.id;
    const current = quantities.get(itemId) || { quantity: 0, unitCost: Number(line.stockUnitCost || 0) };
    current.quantity += Number(line.quantity);
    quantities.set(itemId, current);
  });

  const updated = await prisma.$transaction(async (tx) => {
    for (const [catalogItemId, item] of quantities) {
      const [oldBalance, newBalance] = await Promise.all([
        tx.stockBalance.findUnique({
          where: {
            tenantId_warehouseId_catalogItemId: {
              tenantId: user.tenantId,
              warehouseId: document.warehouseId,
              catalogItemId
            }
          }
        }),
        tx.stockBalance.findUnique({
          where: {
            tenantId_warehouseId_catalogItemId: {
              tenantId: user.tenantId,
              warehouseId: warehouse.id,
              catalogItemId
            }
          }
        })
      ]);
      const available = newBalance
        ? Number(newBalance.onHand) - Number(newBalance.reserved)
        : 0;

      if (!newBalance || available < item.quantity) {
        throw badRequest(
          `Stock insuficiente en ${warehouse.name} para cambiar la bodega del documento`
        );
      }

      if (oldBalance) {
        await tx.stockBalance.update({
          where: { id: oldBalance.id },
          data: { onHand: { increment: decimalString(item.quantity, 4) }, version: { increment: 1 } }
        });
      } else {
        await tx.stockBalance.create({
          data: {
            tenantId: user.tenantId,
            companyId: document.companyId,
            branchId: document.branchId,
            warehouseId: document.warehouseId,
            catalogItemId,
            onHand: decimalString(item.quantity, 4),
            averageCost: decimalString(item.unitCost)
          }
        });
      }

      const requiredOnHand = item.quantity + Number(newBalance.reserved || 0);
      const stockUpdate = await tx.stockBalance.updateMany({
        where: { id: newBalance.id, onHand: { gte: decimalString(requiredOnHand, 4) } },
        data: { onHand: { decrement: decimalString(item.quantity, 4) }, version: { increment: 1 } }
      });

      if (stockUpdate.count !== 1) {
        throw badRequest(`El stock de ${warehouse.name} cambio; vuelva a intentar`);
      }

      const newStock = await tx.stockBalance.findUnique({ where: { id: newBalance.id } });
      const changeId = crypto.randomUUID();
      await tx.inventoryMovement.createMany({
        data: [
          {
            tenantId: user.tenantId,
            companyId: document.companyId,
            branchId: document.branchId,
            warehouseId: document.warehouseId,
            catalogItemId,
            type: "ADJUSTMENT_IN",
            quantityIn: decimalString(item.quantity, 4),
            quantityOut: "0.0000",
            previousOnHand: decimalString(Number(oldBalance?.onHand || 0), 4),
            nextOnHand: decimalString(Number(oldBalance?.onHand || 0) + item.quantity, 4),
            unitCost: decimalString(item.unitCost),
            totalCost: decimalString(item.quantity * item.unitCost),
            sourceType: "SALE",
            sourceId: document.id,
            reference: `Cambio de bodega ${document.documentNumber}`,
            correlationId: document.correlationId,
            idempotencyKey: `${document.id}:warehouse-return:${catalogItemId}:${changeId}`,
            responsibleUserId: user.id,
            effectiveAt: new Date()
          },
          {
            tenantId: user.tenantId,
            companyId: document.companyId,
            branchId: document.branchId,
            warehouseId: warehouse.id,
            catalogItemId,
            type: "ADJUSTMENT_OUT",
            quantityIn: "0.0000",
            quantityOut: decimalString(item.quantity, 4),
            previousOnHand: decimalString(Number(newBalance.onHand), 4),
            nextOnHand: decimalString(Number(newStock.onHand), 4),
            unitCost: decimalString(item.unitCost),
            totalCost: decimalString(item.quantity * item.unitCost),
            sourceType: "SALE",
            sourceId: document.id,
            reference: `Cambio de bodega ${document.documentNumber}`,
            correlationId: document.correlationId,
            idempotencyKey: `${document.id}:warehouse-out:${catalogItemId}:${changeId}`,
            responsibleUserId: user.id,
            effectiveAt: new Date()
          }
        ]
      });
    }

    return tx.sale.update({
      where: { id: document.id },
      data: { warehouseId: warehouse.id },
      select: documentSelect({ includeXml: true })
    });
  });

  return mapDocument(updated);
}

async function getRidePdf(user, id) {
  const document = await prisma.sale.findFirst({
    where: scopedSaleWhere(user, { id }),
    select: documentSelect()
  });

  if (!document) {
    throw notFound("Documento no encontrado");
  }

  if (document.documentType !== "INVOICE") {
    throw badRequest("El RIDE PDF solo esta disponible para facturas");
  }

  if (document.sriStatus !== "AUTHORIZED") {
    throw badRequest("El RIDE PDF solo se descarga cuando la factura esta AUTORIZADA por el SRI");
  }

  const pdf = await buildRidePdf(document);
  return {
    pdf,
    fileName: `RIDE-${documentParts(document).number}.pdf`
  };
}

async function createDocument(user, body = {}) {
  const warehouse = await ensureWarehouse(user, body.warehouseId);
  const documentType = normalizeDocumentType(body.documentType);
  const isCreditNote = documentType === "CREDIT_NOTE";
  const originalInvoiceNumber = isCreditNote
    ? normalizeDocumentNumber(body.relatedDocumentNumber || body.invoiceNumber || body.reference)
    : null;
  const creditNoteReason = isCreditNote
    ? normalizeCreditNoteReason(body.reason || body.motive || body.creditNoteReason || body.description)
    : null;
  const originalInvoice = isCreditNote ? await getCreditNoteInvoice(user, originalInvoiceNumber) : null;

  if (originalInvoice && originalInvoice.companyId !== warehouse.companyId) {
    throw badRequest("La bodega seleccionada no pertenece a la empresa de la factura");
  }

  const customer = isCreditNote
    ? originalInvoice.customerId
      ? await ensureCustomer(user, originalInvoice.customerId, originalInvoice.companyId)
      : null
    : await ensureCustomer(user, body.personId || body.customerId, warehouse.companyId);
  const requiresPayment = documentType !== "PROFORMA" && !isCreditNote;

  if (requiresPayment && !body.paymentMethodId) {
    throw badRequest("Seleccione una forma de pago para poder facturar");
  }

  const paymentMethod = requiresPayment
    ? await ensurePaymentMethod(user.tenantId, body.paymentMethodId)
    : null;
  const creditedByProduct = isCreditNote ? await getCreditedQuantities(user, originalInvoice) : null;
  const lines = isCreditNote
    ? normalizeCreditNoteLines(originalInvoice, body.lines, creditedByProduct)
    : normalizeLines(body.lines);
  const productIds = [...new Set(lines.map((line) => line.catalogItemId))];
  const products = await prisma.catalogItem.findMany({
    where: {
      tenantId: user.tenantId,
      companyId: warehouse.companyId,
      status: "ACTIVE",
      id: { in: productIds }
    },
    select: { id: true, internalCode: true, name: true, cost: true }
  });

  if (products.length !== productIds.length) {
    throw badRequest("Todos los productos deben estar activos y pertenecer a la empresa");
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const productCostById = new Map(products.map((product) => [product.id, Number(product.cost)]));
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const discountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const taxableSubtotal = lines.reduce((sum, line) => sum + line.netSubtotal, 0);
  const taxTotal = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const issueDate = parseDate(body.issueDate, "Fecha de emision") || new Date();
  const { establishmentCode, emissionPoint } = resolveSriNumbering(body, warehouse);
  const requestedNumber = normalizeRequestedDocumentNumber(
    body.documentNumber,
    establishmentCode,
    emissionPoint
  );

  const sale = await prisma
    .$transaction(async (tx) => {
      const numbering = await reserveDocumentNumber(
        tx,
        {
          tenantId: user.tenantId,
          companyId: warehouse.companyId,
          documentType,
          establishmentCode,
          emissionPoint
        },
        requestedNumber
      );

      const created = await tx.sale.create({
        data: {
        tenantId: user.tenantId,
        companyId: warehouse.companyId,
        branchId: warehouse.branchId,
        warehouseId: warehouse.id,
        customerId: customer?.id || null,
        customerType: !customer || customer.identificacion === "999999999" ? "FINAL_CONSUMER" : "RETAIL",
        documentType,
        status: "CONFIRMED",
        issueDate,
        dueDate: issueDate,
        delivered: requiresPayment,
        deliveredAt: requiresPayment ? new Date() : null,
        deliveredBy: requiresPayment ? user.id : null,
        establishmentCode,
        emissionPoint,
        sequential: numbering.sequential,
        documentNumber: numbering.documentNumber,
        purchaseOrder: body.purchaseOrder?.trim() || null,
        reference: isCreditNote ? originalInvoice.documentNumber : body.reference?.trim() || null,
        description: isCreditNote ? creditNoteReason : body.description?.trim() || null,
        subtotal: decimalString(subtotal),
        discountTotal: decimalString(discountTotal),
        taxableSubtotal: decimalString(taxableSubtotal),
        taxTotal: decimalString(taxTotal),
        total: decimalString(total),
        sriStatus: documentType === "INVOICE" ? "PENDING_REVIEW" : "NOT_APPLICABLE",
        createdBy: user.id,
        lines: {
          create: lines.map((line) => ({
            catalogItemId: line.catalogItemId,
            quantity: decimalString(line.quantity, 4),
            unitPrice: decimalString(line.unitPrice),
            unit: line.unit,
            discountAmount: decimalString(line.discountAmount),
            netSubtotal: decimalString(line.netSubtotal),
            taxRatePercent: decimalString(line.taxRatePercent, 2),
            taxAmount: decimalString(line.taxAmount),
            lineTotal: decimalString(line.lineTotal),
            incomeTaxRetention: decimalString(line.incomeTaxRetention),
            ivaRetention: decimalString(line.ivaRetention),
            stockUnitCost: decimalString(
              isCreditNote ? line.stockUnitCost : productCostById.get(line.catalogItemId)
            )
          }))
        },
        ...(paymentMethod
          ? {
              payments: {
                create: {
                  paymentMethodId: paymentMethod.id,
                  amount: decimalString(total),
                  reference: body.paymentReference?.trim() || null
                }
              }
            }
          : {})
        }
      });

      if (documentType === "INVOICE" || documentType === "SALES_NOTE") {
        await applySaleInventoryMovements(tx, user, warehouse, created, lines, productById);
      }

      if (documentType === "CREDIT_NOTE") {
        await applyCreditNoteInventoryMovements(tx, user, warehouse, created, lines);
      }

      const documentForXml = await tx.sale.findFirst({
        where: { id: created.id, tenantId: user.tenantId },
        select: documentSelect()
      });

      if (documentType === "INVOICE") {
        const sriInvoice = buildSriInvoiceXml(documentForXml);
        validateInvoiceXml(sriInvoice.xml);

        return tx.sale.update({
          where: { id: created.id },
          data: {
            sriAccessKey: sriInvoice.accessKey,
            sriUnsignedXml: sriInvoice.xml,
            sriXml: sriInvoice.xml,
            sriGeneratedAt: new Date(),
            sriStatus: "PENDING_REVIEW"
          },
          select: documentSelect({ includeXml: true })
        });
      }

      return documentForXml;
    })
    .catch((error) => {
      if (error.code === "P2002") {
        throw badRequest(
          `Número de documento repetido: ${
            requestedNumber?.documentNumber || body.documentNumber || "el número indicado"
          }. Este documento no puede volver a enviarse.`
        );
      }

      throw error;
    });

  return mapDocument(sale);
}

module.exports = {
  DOCUMENT_TYPES,
  listDocuments,
  getDocument,
  validateSriDocument,
  sendSriDocument,
  consultSriAuthorization,
  sendAuthorizedInvoiceEmail,
  updateDocumentWarehouse,
  getRidePdf,
  validateCreditNoteInvoice,
  createDocument,
  _test: {
    normalizeRequestedDocumentNumber,
    reserveDocumentNumber,
    resolveSriNumbering,
    scopedSaleWhere,
    calculateElectronicMilestones,
    assertEmailSendAllowed
  }
};
