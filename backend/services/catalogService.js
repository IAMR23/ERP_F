const { prisma } = require("../config/db");
const { compressProductImage, removeStoredImage } = require("./imageService");

function decimal(value, fallback = "0") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error("Los valores numericos deben ser mayores o iguales a cero");
    error.statusCode = 400;
    throw error;
  }

  return number.toFixed(2);
}

function normalizeStatus(status) {
  return status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

async function getScopedCompany(tenantId, companyId) {
  const company = await prisma.company.findFirst({
    where: { id: companyId, tenantId, status: "ACTIVE" }
  });

  if (!company) {
    const error = new Error("Empresa no encontrada");
    error.statusCode = 404;
    throw error;
  }

  return company;
}

async function getIvaTaxRate(tenantId, hasIva) {
  const code = hasIva ? "IVA_15" : "IVA_0";
  const taxRate = await prisma.taxRate.findFirst({
    where: { tenantId, code, status: "ACTIVE" }
  });

  if (!taxRate) {
    const error = new Error(`No existe la tarifa ${code}. Ejecuta el seed.`);
    error.statusCode = 400;
    throw error;
  }

  return taxRate;
}

function productSelect() {
  return {
    id: true,
    tenantId: true,
    companyId: true,
    subcategoryId: true,
    name: true,
    description: true,
    internalCode: true,
    barcode: true,
    model: true,
    pvp1: true,
    pvp2: true,
    pvp3: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    company: { select: { id: true, tradeName: true } },
    subcategory: {
      select: {
        id: true,
        name: true,
        category: { select: { id: true, name: true } }
      }
    },
    taxRate: { select: { id: true, code: true, name: true, ratePercent: true } },
    images: {
      where: { status: "ACTIVE", isPrimary: true },
      select: { id: true, objectKey: true, mimeType: true, sizeBytes: true },
      take: 1
    }
  };
}

function formatProduct(product) {
  const image = product.images?.[0];

  return {
    ...product,
    hasIva: product.taxRate?.code === "IVA_15",
    imageUrl: image ? `/uploads/${image.objectKey}` : null
  };
}

async function listCategories(tenantId) {
  return prisma.category.findMany({
    where: { tenantId, type: "PRODUCT" },
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
}

async function createCategory(tenantId, body) {
  if (!body.name?.trim()) {
    const error = new Error("El nombre de categoria es requerido");
    error.statusCode = 400;
    throw error;
  }

  return prisma.category.create({
    data: {
      tenantId,
      type: "PRODUCT",
      name: body.name.trim(),
      description: body.description?.trim() || null,
      status: normalizeStatus(body.status)
    }
  });
}

async function updateCategory(tenantId, id, body) {
  await ensureCategory(tenantId, id);

  return prisma.category.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      description: body.description?.trim() || null,
      status: normalizeStatus(body.status)
    }
  });
}

async function ensureCategory(tenantId, id) {
  const category = await prisma.category.findFirst({ where: { id, tenantId, type: "PRODUCT" } });
  if (!category) {
    const error = new Error("Categoria no encontrada");
    error.statusCode = 404;
    throw error;
  }
  return category;
}

async function listSubcategories(tenantId, categoryId) {
  return prisma.subcategory.findMany({
    where: {
      tenantId,
      ...(categoryId ? { categoryId } : {})
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }]
  });
}

async function createSubcategory(tenantId, body) {
  if (!body.name?.trim() || !body.categoryId) {
    const error = new Error("Categoria y nombre de subcategoria son requeridos");
    error.statusCode = 400;
    throw error;
  }

  await ensureCategory(tenantId, body.categoryId);

  return prisma.subcategory.create({
    data: {
      tenantId,
      categoryId: body.categoryId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      status: normalizeStatus(body.status)
    },
    include: { category: { select: { id: true, name: true } } }
  });
}

async function updateSubcategory(tenantId, id, body) {
  await ensureSubcategory(tenantId, id);

  if (body.categoryId) {
    await ensureCategory(tenantId, body.categoryId);
  }

  return prisma.subcategory.update({
    where: { id },
    data: {
      categoryId: body.categoryId,
      name: body.name?.trim(),
      description: body.description?.trim() || null,
      status: normalizeStatus(body.status)
    },
    include: { category: { select: { id: true, name: true } } }
  });
}

async function ensureSubcategory(tenantId, id) {
  const subcategory = await prisma.subcategory.findFirst({
    where: { id, tenantId },
    include: { category: true }
  });

  if (!subcategory) {
    const error = new Error("Subcategoria no encontrada");
    error.statusCode = 404;
    throw error;
  }

  return subcategory;
}

async function listCompanies(tenantId) {
  return prisma.company.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: { id: true, tradeName: true, ruc: true },
    orderBy: { tradeName: "asc" }
  });
}

async function listProducts(tenantId) {
  const products = await prisma.catalogItem.findMany({
    where: { tenantId },
    select: productSelect(),
    orderBy: { createdAt: "desc" }
  });

  return products.map(formatProduct);
}

async function getProduct(tenantId, id) {
  const product = await prisma.catalogItem.findFirst({
    where: { id, tenantId },
    select: productSelect()
  });

  if (!product) {
    const error = new Error("Producto no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return formatProduct(product);
}

async function createProduct(tenantId, userId, body, file) {
  const payload = await buildProductPayload(tenantId, body);
  const image = await compressProductImage(file);

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogItem.create({
      data: payload,
      select: productSelect()
    });

    if (image) {
      await tx.catalogItemImage.create({
        data: {
          tenantId,
          catalogItemId: created.id,
          objectKey: image.objectKey,
          originalFileName: image.originalFileName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          width: image.width,
          height: image.height,
          position: 1,
          isPrimary: true,
          createdBy: userId
        }
      });
    }

    return tx.catalogItem.findFirst({
      where: { id: created.id, tenantId },
      select: productSelect()
    });
  });

  return formatProduct(product);
}

async function updateProduct(tenantId, userId, id, body, file) {
  await getProduct(tenantId, id);
  const payload = await buildProductPayload(tenantId, body, { partial: true });
  const image = await compressProductImage(file);

  const product = await prisma.$transaction(async (tx) => {
    await tx.catalogItem.update({
      where: { id },
      data: payload
    });

    if (image) {
      const previousImages = await tx.catalogItemImage.findMany({
        where: { tenantId, catalogItemId: id, status: "ACTIVE" }
      });

      await tx.catalogItemImage.updateMany({
        where: { tenantId, catalogItemId: id },
        data: { isPrimary: false, status: "INACTIVE" }
      });

      await tx.catalogItemImage.create({
        data: {
          tenantId,
          catalogItemId: id,
          objectKey: image.objectKey,
          originalFileName: image.originalFileName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          width: image.width,
          height: image.height,
          position: 1,
          isPrimary: true,
          createdBy: userId
        }
      });

      await Promise.all(previousImages.map((storedImage) => removeStoredImage(storedImage.objectKey)));
    }

    return tx.catalogItem.findFirst({
      where: { id, tenantId },
      select: productSelect()
    });
  });

  return formatProduct(product);
}

async function deleteProduct(tenantId, id) {
  await getProduct(tenantId, id);

  return prisma.catalogItem.update({
    where: { id },
    data: { status: "INACTIVE" },
    select: productSelect()
  });
}

async function buildProductPayload(tenantId, body, options = {}) {
  const required = ["internalCode", "name", "subcategoryId", "companyId"];

  if (!options.partial) {
    for (const field of required) {
      if (!body[field]) {
        const error = new Error(`Campo requerido: ${field}`);
        error.statusCode = 400;
        throw error;
      }
    }
  }

  const data = {};

  if (body.companyId) {
    const company = await getScopedCompany(tenantId, body.companyId);
    data.companyId = company.id;
  }

  if (body.subcategoryId) {
    await ensureSubcategory(tenantId, body.subcategoryId);
    data.subcategoryId = body.subcategoryId;
  }

  if (body.internalCode !== undefined) data.internalCode = String(body.internalCode).trim();
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.barcode !== undefined) data.barcode = body.barcode?.trim() || null;
  if (body.model !== undefined) data.model = body.model?.trim() || null;
  if (body.status !== undefined) data.status = normalizeStatus(body.status);

  if (body.pvp1 !== undefined) {
    data.pvp1 = decimal(body.pvp1);
    data.pvp = data.pvp1;
    data.finalPrice = data.pvp1;
    data.salePrice = data.pvp1;
  }

  if (body.pvp2 !== undefined) data.pvp2 = decimal(body.pvp2);
  if (body.pvp3 !== undefined) data.pvp3 = decimal(body.pvp3);

  if (body.hasIva !== undefined) {
    const hasIva = body.hasIva === true || body.hasIva === "true";
    const taxRate = await getIvaTaxRate(tenantId, hasIva);
    data.taxRateId = taxRate.id;
  }

  if (!options.partial) {
    data.tenantId = tenantId;
    data.status = data.status || "ACTIVE";
    data.unitPrice = "0.00";
    data.cost = "0.00";
    data.pvp1 = data.pvp1 || "0.00";
    data.pvp2 = data.pvp2 || "0.00";
    data.pvp3 = data.pvp3 || "0.00";
    data.pvp = data.pvp || data.pvp1;
    data.finalPrice = data.finalPrice || data.pvp1;
    data.salePrice = data.salePrice || data.pvp1;

    if (!data.taxRateId) {
      const taxRate = await getIvaTaxRate(tenantId, false);
      data.taxRateId = taxRate.id;
    }
  }

  return data;
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  listCompanies,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};
