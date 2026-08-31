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

function toDecimalString(value, scale = 4) {
  return Number(value).toFixed(scale);
}

function parsePositiveNumber(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw badRequest(`${field} debe ser mayor a 0`);
  }

  return number;
}

function parseNonNegativeNumber(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw badRequest(`${field} no puede ser negativo`);
  }

  return number;
}

function scopedCompanyWhere(req, where = {}) {
  const scopes = [{ tenantId: req.user.tenantId, ...where }];

  if (req.user.companyIds.length) {
    scopes.push({ companyId: { in: req.user.companyIds } });
  }

  return { AND: scopes };
}

function scopedBranchWhere(req, where = {}) {
  const scopes = [{ tenantId: req.user.tenantId, ...where }];

  if (req.user.companyIds.length) {
    scopes.push({ companyId: { in: req.user.companyIds } });
  }

  if (req.user.branchIds.length) {
    scopes.push({ id: { in: req.user.branchIds } });
  }

  return { AND: scopes };
}

function scopedWarehouseWhere(req, where = {}) {
  const scopes = [{ tenantId: req.user.tenantId, ...where }];

  if (req.user.companyIds.length) {
    scopes.push({ companyId: { in: req.user.companyIds } });
  }

  if (req.user.branchIds.length) {
    scopes.push({ branchId: { in: req.user.branchIds } });
  }

  return { AND: scopes };
}

function mapStockBalance(balance) {
  return {
    id: balance.id,
    onHand: Number(balance.onHand),
    reserved: Number(balance.reserved),
    averageCost: Number(balance.averageCost),
    product: {
      id: balance.catalogItem.id,
      name: balance.catalogItem.name,
      internalCode: balance.catalogItem.internalCode
    }
  };
}

function normalizeTransferLines(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    throw badRequest("Agrega al menos un producto para transferir");
  }

  return Object.values(
    lines.reduce((acc, line, index) => {
      if (!line.catalogItemId) {
        throw badRequest(`Producto requerido en la linea ${index + 1}`);
      }

      const quantity = parsePositiveNumber(line.quantity, `Cantidad de la linea ${index + 1}`);
      const current = acc[line.catalogItemId] || { catalogItemId: line.catalogItemId, quantity: 0 };

      current.quantity += quantity;
      acc[line.catalogItemId] = current;
      return acc;
    }, {})
  );
}

function mapWarehouse(warehouse) {
  const totalUnits = warehouse.stockBalances.reduce((sum, balance) => sum + Number(balance.onHand), 0);

  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    description: warehouse.description,
    isDefault: warehouse.isDefault,
    status: warehouse.status,
    branch: {
      id: warehouse.branch.id,
      code: warehouse.branch.code,
      name: warehouse.branch.name
    },
    company: {
      id: warehouse.company.id,
      tradeName: warehouse.company.tradeName
    },
    stockBalances: warehouse.stockBalances.map(mapStockBalance),
    totalUnits,
    stockItems: warehouse.stockBalances.length
  };
}

async function obtenerOpcionesBodegas(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const [branches, products, suppliers] = await Promise.all([
      prisma.branch.findMany({
        where: scopedBranchWhere(req, { status: "ACTIVE" }),
        include: { company: { select: { id: true, tradeName: true } } },
        orderBy: [{ companyId: "asc" }, { code: "asc" }]
      }),
      prisma.catalogItem.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          ...(req.user.companyIds.length ? { companyId: { in: req.user.companyIds } } : {})
        },
        select: {
          id: true,
          companyId: true,
          name: true,
          internalCode: true,
          cost: true,
          salePrice: true
        },
        orderBy: [{ name: "asc" }]
      }),
      prisma.person.findMany({
        where: scopedCompanyWhere(req, {
          activo: true,
          roles: {
            some: { role: "PROVEEDOR" }
          }
        }),
        select: {
          id: true,
          identificacion: true,
          nombre: true,
          companyId: true,
          roles: { select: { role: true } }
        },
        orderBy: [{ nombre: "asc" }]
      })
    ]);

    return res.json({
      branches: branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        companyId: branch.companyId,
        companyName: branch.company.tradeName
      })),
      products: products.map((product) => ({
        ...product,
        cost: Number(product.cost),
        salePrice: Number(product.salePrice)
      })),
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        fiscalId: supplier.identificacion,
        legalName: supplier.nombre,
        tradeName: supplier.nombre,
        companyId: supplier.companyId,
        roles: supplier.roles.map((role) => role.role)
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function listarBodegas(req, res, next) {
  try {
    const warehouses = await prisma.warehouse.findMany({
      where: scopedWarehouseWhere(req),
      include: {
        company: { select: { id: true, tradeName: true } },
        branch: { select: { id: true, code: true, name: true } },
        stockBalances: {
          include: {
            catalogItem: {
              select: {
                id: true,
                name: true,
                internalCode: true
              }
            }
          },
          orderBy: { updatedAt: "desc" }
        }
      },
      orderBy: [{ branchId: "asc" }, { code: "asc" }]
    });

    return res.json({ warehouses: warehouses.map(mapWarehouse) });
  } catch (error) {
    return next(error);
  }
}

async function crearBodega(req, res, next) {
  try {
    const { branchId, code, name, description } = req.body;
    const isDefault =
      req.body.isDefault === true ||
      req.body.isDefault === "true" ||
      req.body.isMain === true ||
      req.body.isMain === "true";

    if (!branchId || !code || !name) {
      throw badRequest("Sucursal, codigo y nombre son requeridos");
    }

    const branch = await prisma.branch.findFirst({
      where: scopedBranchWhere(req, { id: branchId, status: "ACTIVE" })
    });

    if (!branch) {
      throw notFound("Sucursal no encontrada");
    }

    const warehouse = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.warehouse.updateMany({
          where: {
            tenantId: req.user.tenantId,
            companyId: branch.companyId,
            branchId: branch.id,
            status: "ACTIVE"
          },
          data: { isDefault: false }
        });
      }

      return tx.warehouse.create({
        data: {
          tenantId: req.user.tenantId,
          companyId: branch.companyId,
          branchId: branch.id,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description?.trim() || null,
          isDefault,
          createdBy: req.user.id
        },
        include: {
          company: { select: { id: true, tradeName: true } },
          branch: { select: { id: true, code: true, name: true } },
          stockBalances: {
            include: {
              catalogItem: {
                select: {
                  id: true,
                  name: true,
                  internalCode: true
                }
              }
            }
          }
        }
      });
    });

    return res.status(201).json({ warehouse: mapWarehouse(warehouse) });
  } catch (error) {
    if (error.code === "P2002") {
      return next(badRequest("Ya existe una bodega con ese codigo en la empresa"));
    }

    return next(error);
  }
}

async function registrarTransferenciaStock(req, res, next) {
  try {
    const sourceWarehouseId = req.params.id;
    const { destinationWarehouseId, reference, reason, lines } = req.body;

    if (!destinationWarehouseId) {
      throw badRequest("Selecciona la bodega destino");
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      throw badRequest("La bodega origen y destino deben ser diferentes");
    }

    const sourceWarehouse = await prisma.warehouse.findFirst({
      where: scopedWarehouseWhere(req, { id: sourceWarehouseId, status: "ACTIVE" })
    });

    if (!sourceWarehouse) {
      throw notFound("Bodega origen no encontrada");
    }

    const destinationWarehouse = await prisma.warehouse.findFirst({
      where: scopedWarehouseWhere(req, { id: destinationWarehouseId, status: "ACTIVE" })
    });

    if (!destinationWarehouse) {
      throw notFound("Bodega destino no encontrada");
    }

    if (sourceWarehouse.companyId !== destinationWarehouse.companyId) {
      throw badRequest("Solo se permiten transferencias entre bodegas de la misma empresa");
    }

    const mergedLines = normalizeTransferLines(lines);
    const products = await prisma.catalogItem.findMany({
      where: {
        tenantId: req.user.tenantId,
        companyId: sourceWarehouse.companyId,
        status: "ACTIVE",
        id: { in: mergedLines.map((line) => line.catalogItemId) }
      },
      select: { id: true, internalCode: true, name: true }
    });

    if (products.length !== mergedLines.length) {
      throw badRequest("Todos los productos deben estar activos y pertenecer a la empresa");
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const now = new Date();

    const transfer = await prisma.$transaction(async (tx) => {
      const createdTransfer = await tx.stockTransfer.create({
        data: {
          tenantId: req.user.tenantId,
          companyId: sourceWarehouse.companyId,
          sourceWarehouseId: sourceWarehouse.id,
          destinationWarehouseId: destinationWarehouse.id,
          status: "RECEIVED",
          reference: reference?.trim() || null,
          reason: reason?.trim() || null,
          requestedBy: req.user.id,
          requestedAt: now,
          approvedBy: req.user.id,
          approvedAt: now,
          dispatchedBy: req.user.id,
          dispatchedAt: now,
          receivedBy: req.user.id,
          receivedAt: now
        }
      });

      for (const [index, line] of mergedLines.entries()) {
        const product = productById.get(line.catalogItemId);
        const sourceBalance = await tx.stockBalance.findUnique({
          where: {
            tenantId_warehouseId_catalogItemId: {
              tenantId: req.user.tenantId,
              warehouseId: sourceWarehouse.id,
              catalogItemId: line.catalogItemId
            }
          }
        });

        const previousSourceOnHand = sourceBalance ? Number(sourceBalance.onHand) : 0;
        const availableSource = sourceBalance
          ? Math.max(0, Number(sourceBalance.onHand) - Number(sourceBalance.reserved))
          : 0;

        if (!sourceBalance || availableSource < line.quantity) {
          throw badRequest(
            `Stock insuficiente para ${product.internalCode} - ${product.name}. Disponible: ${toDecimalString(
              availableSource,
              4
            )}`
          );
        }

        const unitCost = Number(sourceBalance.averageCost);
        const totalCost = line.quantity * unitCost;
        const sourceUpdate = await tx.stockBalance.updateMany({
          where: {
            id: sourceBalance.id,
            onHand: { gte: toDecimalString(line.quantity, 4) }
          },
          data: {
            onHand: { decrement: toDecimalString(line.quantity, 4) },
            version: { increment: 1 }
          }
        });

        if (sourceUpdate.count !== 1) {
          throw badRequest(`Stock insuficiente para ${product.internalCode} - ${product.name}`);
        }

        const nextSourceOnHand = previousSourceOnHand - line.quantity;
        const destinationBalance = await tx.stockBalance.findUnique({
          where: {
            tenantId_warehouseId_catalogItemId: {
              tenantId: req.user.tenantId,
              warehouseId: destinationWarehouse.id,
              catalogItemId: line.catalogItemId
            }
          }
        });
        const previousDestinationOnHand = destinationBalance ? Number(destinationBalance.onHand) : 0;
        const previousDestinationAverageCost = destinationBalance
          ? Number(destinationBalance.averageCost)
          : 0;
        const nextDestinationOnHand = previousDestinationOnHand + line.quantity;
        const nextDestinationAverageCost =
          nextDestinationOnHand > 0
            ? (previousDestinationOnHand * previousDestinationAverageCost + totalCost) /
              nextDestinationOnHand
            : unitCost;

        if (destinationBalance) {
          await tx.stockBalance.update({
            where: { id: destinationBalance.id },
            data: {
              onHand: { increment: toDecimalString(line.quantity, 4) },
              averageCost: toDecimalString(nextDestinationAverageCost, 6),
              version: { increment: 1 }
            }
          });
        } else {
          await tx.stockBalance.create({
            data: {
              tenantId: req.user.tenantId,
              companyId: destinationWarehouse.companyId,
              branchId: destinationWarehouse.branchId,
              warehouseId: destinationWarehouse.id,
              catalogItemId: line.catalogItemId,
              onHand: toDecimalString(line.quantity, 4),
              averageCost: toDecimalString(unitCost, 6)
            }
          });
        }

        await tx.stockTransferLine.create({
          data: {
            stockTransferId: createdTransfer.id,
            catalogItemId: line.catalogItemId,
            quantity: toDecimalString(line.quantity, 4),
            unitCost: toDecimalString(unitCost, 6)
          }
        });

        await tx.inventoryMovement.createMany({
          data: [
            {
              tenantId: req.user.tenantId,
              companyId: sourceWarehouse.companyId,
              branchId: sourceWarehouse.branchId,
              warehouseId: sourceWarehouse.id,
              catalogItemId: line.catalogItemId,
              type: "TRANSFER_OUT",
              quantityIn: "0.0000",
              quantityOut: toDecimalString(line.quantity, 4),
              previousOnHand: toDecimalString(previousSourceOnHand, 4),
              nextOnHand: toDecimalString(nextSourceOnHand, 4),
              unitCost: toDecimalString(unitCost, 6),
              totalCost: toDecimalString(totalCost, 6),
              sourceType: "STOCK_TRANSFER",
              sourceId: createdTransfer.id,
              reference: reference?.trim() || reason?.trim() || null,
              correlationId: createdTransfer.correlationId,
              idempotencyKey: `${createdTransfer.id}:${line.catalogItemId}:out:${index}`,
              responsibleUserId: req.user.id
            },
            {
              tenantId: req.user.tenantId,
              companyId: destinationWarehouse.companyId,
              branchId: destinationWarehouse.branchId,
              warehouseId: destinationWarehouse.id,
              catalogItemId: line.catalogItemId,
              type: "TRANSFER_IN",
              quantityIn: toDecimalString(line.quantity, 4),
              quantityOut: "0.0000",
              previousOnHand: toDecimalString(previousDestinationOnHand, 4),
              nextOnHand: toDecimalString(nextDestinationOnHand, 4),
              unitCost: toDecimalString(unitCost, 6),
              totalCost: toDecimalString(totalCost, 6),
              sourceType: "STOCK_TRANSFER",
              sourceId: createdTransfer.id,
              reference: reference?.trim() || reason?.trim() || null,
              correlationId: createdTransfer.correlationId,
              idempotencyKey: `${createdTransfer.id}:${line.catalogItemId}:in:${index}`,
              responsibleUserId: req.user.id
            }
          ]
        });
      }

      return tx.stockTransfer.findUnique({
        where: { id: createdTransfer.id },
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              catalogItem: { select: { id: true, internalCode: true, name: true } }
            }
          }
        }
      });
    });

    return res.status(201).json({
      transfer: {
        id: transfer.id,
        status: transfer.status,
        reference: transfer.reference,
        reason: transfer.reason,
        sourceWarehouse: transfer.sourceWarehouse,
        destinationWarehouse: transfer.destinationWarehouse,
        lines: transfer.lines.map((line) => ({
          id: line.id,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          product: line.catalogItem
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function registrarEntradaStock(req, res, next) {
  try {
    const warehouseId = req.params.id;
    const {
      type,
      supplierId,
      documentNumber,
      documentDate,
      fiscalAuth,
      reference,
      reason,
      lines
    } = req.body;

    if (!["MANUAL", "PURCHASE_INVOICE"].includes(type)) {
      throw badRequest("Tipo de entrada invalido");
    }

    if (!Array.isArray(lines) || !lines.length) {
      throw badRequest("Agrega al menos un producto");
    }

    if (type === "PURCHASE_INVOICE" && !supplierId) {
      throw badRequest("Selecciona un proveedor para la factura");
    }

    const parsedDocumentDate = documentDate ? new Date(documentDate) : null;

    if (parsedDocumentDate && Number.isNaN(parsedDocumentDate.getTime())) {
      throw badRequest("Fecha de documento invalida");
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: scopedWarehouseWhere(req, { id: warehouseId, status: "ACTIVE" })
    });

    if (!warehouse) {
      throw notFound("Bodega no encontrada");
    }

    const supplier = supplierId
      ? await prisma.person.findFirst({
          where: {
            tenantId: req.user.tenantId,
            companyId: warehouse.companyId,
            id: supplierId,
            activo: true,
            roles: {
              some: { role: "PROVEEDOR" }
            }
          }
        })
      : null;

    if (supplierId && !supplier) {
      throw notFound("Proveedor no encontrado");
    }

    const normalizedLines = lines.map((line, index) => {
      if (!line.catalogItemId) {
        throw badRequest(`Producto requerido en la linea ${index + 1}`);
      }

      const quantity = parsePositiveNumber(line.quantity, `Cantidad de la linea ${index + 1}`);
      const unitCost = parseNonNegativeNumber(line.unitCost, `Costo de la linea ${index + 1}`);

      return {
        catalogItemId: line.catalogItemId,
        quantity,
        unitCost,
        totalCost: quantity * unitCost
      };
    });

    const mergedLines = Object.values(
      normalizedLines.reduce((acc, line) => {
        const current = acc[line.catalogItemId] || {
          catalogItemId: line.catalogItemId,
          quantity: 0,
          totalCost: 0
        };

        current.quantity += line.quantity;
        current.totalCost += line.totalCost;
        current.unitCost = current.totalCost / current.quantity;
        acc[line.catalogItemId] = current;
        return acc;
      }, {})
    );

    const products = await prisma.catalogItem.findMany({
      where: {
        tenantId: req.user.tenantId,
        companyId: warehouse.companyId,
        status: "ACTIVE",
        id: { in: mergedLines.map((line) => line.catalogItemId) }
      },
      select: { id: true }
    });

    if (products.length !== mergedLines.length) {
      throw badRequest("Todos los productos deben estar activos y pertenecer a la empresa de la bodega");
    }

    const entry = await prisma.$transaction(async (tx) => {
      const createdEntry = await tx.stockEntry.create({
        data: {
          tenantId: req.user.tenantId,
          companyId: warehouse.companyId,
          branchId: warehouse.branchId,
          warehouseId: warehouse.id,
          supplierId: supplier?.id || null,
          type,
          status: "CONFIRMED",
          documentNumber: documentNumber?.trim() || null,
          documentDate: parsedDocumentDate,
          fiscalAuth: fiscalAuth?.trim() || null,
          reference: reference?.trim() || null,
          reason: reason?.trim() || null,
          confirmedAt: new Date(),
          createdBy: req.user.id,
          confirmedBy: req.user.id,
          lines: {
            create: mergedLines.map((line) => ({
              catalogItemId: line.catalogItemId,
              quantity: toDecimalString(line.quantity, 4),
              unitCost: toDecimalString(line.unitCost, 6),
              totalCost: toDecimalString(line.totalCost, 6)
            }))
          }
        }
      });

      for (const [index, line] of mergedLines.entries()) {
        const balance = await tx.stockBalance.findUnique({
          where: {
            tenantId_warehouseId_catalogItemId: {
              tenantId: req.user.tenantId,
              warehouseId: warehouse.id,
              catalogItemId: line.catalogItemId
            }
          }
        });

        const previousOnHand = balance ? Number(balance.onHand) : 0;
        const previousAverageCost = balance ? Number(balance.averageCost) : 0;
        const nextOnHand = previousOnHand + line.quantity;
        const nextAverageCost =
          nextOnHand > 0
            ? (previousOnHand * previousAverageCost + line.totalCost) / nextOnHand
            : line.unitCost;

        if (balance) {
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: {
              onHand: toDecimalString(nextOnHand, 4),
              averageCost: toDecimalString(nextAverageCost, 6),
              version: { increment: 1 }
            }
          });
        } else {
          await tx.stockBalance.create({
            data: {
              tenantId: req.user.tenantId,
              companyId: warehouse.companyId,
              branchId: warehouse.branchId,
              warehouseId: warehouse.id,
              catalogItemId: line.catalogItemId,
              onHand: toDecimalString(nextOnHand, 4),
              averageCost: toDecimalString(nextAverageCost, 6)
            }
          });
        }

        await tx.inventoryMovement.create({
          data: {
            tenantId: req.user.tenantId,
            companyId: warehouse.companyId,
            branchId: warehouse.branchId,
            warehouseId: warehouse.id,
            catalogItemId: line.catalogItemId,
            type: "STOCK_ENTRY",
            quantityIn: toDecimalString(line.quantity, 4),
            quantityOut: "0.0000",
            previousOnHand: toDecimalString(previousOnHand, 4),
            nextOnHand: toDecimalString(nextOnHand, 4),
            unitCost: toDecimalString(line.unitCost, 6),
            totalCost: toDecimalString(line.totalCost, 6),
            sourceType: "STOCK_ENTRY",
            sourceId: createdEntry.id,
            reference: documentNumber?.trim() || reference?.trim() || reason?.trim() || null,
            correlationId: createdEntry.correlationId,
            idempotencyKey: `${createdEntry.id}:${line.catalogItemId}:${index}`,
            responsibleUserId: req.user.id
          }
        });
      }

      return tx.stockEntry.findUnique({
        where: { id: createdEntry.id },
        include: {
          supplier: { select: { id: true, nombre: true, identificacion: true } },
          lines: {
            include: {
              catalogItem: {
                select: {
                  id: true,
                  name: true,
                  internalCode: true
                }
              }
            }
          }
        }
      });
    });

    return res.status(201).json({
      entry: {
        id: entry.id,
        type: entry.type,
        status: entry.status,
        documentNumber: entry.documentNumber,
        reference: entry.reference,
        supplier: entry.supplier
          ? {
              id: entry.supplier.id,
              legalName: entry.supplier.nombre,
              tradeName: entry.supplier.nombre,
              fiscalId: entry.supplier.identificacion
            }
          : null,
        lines: entry.lines.map((line) => ({
          id: line.id,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          totalCost: Number(line.totalCost),
          product: line.catalogItem
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obtenerOpcionesBodegas,
  listarBodegas,
  crearBodega,
  registrarTransferenciaStock,
  registrarEntradaStock
};
