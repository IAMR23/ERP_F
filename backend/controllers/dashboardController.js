const { prisma } = require("../config/db");

async function obtenerDashboard(req, res, next) {
  try {
    const tenantId = req.user.tenantId;
    const [companies, branches, warehouses, products, stockBalances, sales] = await Promise.all([
      prisma.company.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.branch.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.warehouse.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.catalogItem.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.stockBalance.count({ where: { tenantId } }),
      prisma.sale.count({ where: { tenantId } })
    ]);

    const companyRows = await prisma.company.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: { id: true, tradeName: true, ruc: true, email: true },
      orderBy: { createdAt: "asc" },
      take: 5
    });

    const productRows = await prisma.catalogItem.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        internalCode: true,
        salePrice: true,
        cost: true
      },
      orderBy: { createdAt: "asc" },
      take: 5
    });

    return res.json({
      metrics: { companies, branches, warehouses, products, stockBalances, sales },
      companies: companyRows,
      products: productRows
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obtenerDashboard
};
