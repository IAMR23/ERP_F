const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PERMISSIONS } = require("../services/permissionService");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@erp.local").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";

  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "ERP Demo",
      storageQuotaBytes: BigInt("104857600")
    }
  });

  const permissionRows = await Promise.all(
    PERMISSIONS.map((code) =>
      prisma.permission.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code } },
        update: { description: code },
        create: { tenantId: tenant.id, code, description: code }
      })
    )
  );

  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Administrador" } },
    update: { description: "Usuario principal con permisos completos del ERP" },
    create: {
      tenantId: tenant.id,
      name: "Administrador",
      description: "Usuario principal con permisos completos del ERP"
    }
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissionRows.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
    skipDuplicates: true
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { passwordHash, name: "Administrador ERP", username: "admin" },
    create: {
      tenantId: tenant.id,
      username: "admin",
      email,
      name: "Administrador ERP",
      passwordHash
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id }
  });

  const company = await prisma.company.upsert({
    where: { tenantId_ruc: { tenantId: tenant.id, ruc: "1790012345001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      legalName: "ERP Demo S.A.",
      tradeName: "ERP Demo",
      ruc: "1790012345001",
      mainAddress: "Av. Demo y Principal",
      email: "demo@erp.local",
      phone: "0999999999",
      createdBy: user.id
    }
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: "001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      code: "001",
      name: "Matriz",
      address: "Av. Demo y Principal",
      phone: "0999999999",
      email: "matriz@erp.local",
      managerName: "Administrador ERP",
      sriEstablishmentCode: "001"
    }
  });

  await prisma.userCompanyScope.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: {},
    create: { userId: user.id, companyId: company.id }
  });

  await prisma.userBranchScope.upsert({
    where: { userId_branchId: { userId: user.id, branchId: branch.id } },
    update: {},
    create: { userId: user.id, branchId: branch.id }
  });

  const paymentMethods = [
    { code: "TRANSFER", name: "Transferencia" },
    { code: "CASH", name: "Efectivo" },
    { code: "CREDIT_CARD", name: "T. Credito" },
    { code: "DEBIT_CARD", name: "T. Debito" },
    { code: "SHARED_PAYMENTS", name: "P. Compartidos" }
  ];

  for (const paymentMethod of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: paymentMethod.code } },
      update: { name: paymentMethod.name, status: "ACTIVE" },
      create: { tenantId: tenant.id, ...paymentMethod, status: "ACTIVE" }
    });
  }

  const iva15 = await prisma.taxRate.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "IVA_15" } },
    update: { name: "IVA 15%", ratePercent: "15.00", status: "ACTIVE" },
    create: { tenantId: tenant.id, code: "IVA_15", name: "IVA 15%", ratePercent: "15.00" }
  });

  await prisma.taxRate.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "IVA_0" } },
    update: { name: "Sin IVA", ratePercent: "0.00", status: "ACTIVE" },
    create: { tenantId: tenant.id, code: "IVA_0", name: "Sin IVA", ratePercent: "0.00" }
  });

  const demoPeople = [
    {
      tipoPersona: "NATURAL",
      tipoIdentificacion: "CEDULA",
      identificacion: "999999999",
      nombre: "Consumidor Final",
      roles: ["CLIENTE"]
    },
    {
      tipoPersona: "NATURAL",
      tipoIdentificacion: "CEDULA",
      identificacion: "1700000001",
      nombre: "Cliente Demo",
      email: "cliente@erp.local",
      telefono: "0991111111",
      roles: ["CLIENTE"]
    },
    {
      tipoPersona: "JURIDICA",
      tipoIdentificacion: "RUC",
      identificacion: "1790099999001",
      nombre: "Proveedor Demo S.A.",
      email: "proveedor@erp.local",
      telefono: "022222222",
      direccion: "Zona industrial demo",
      roles: ["PROVEEDOR"]
    }
  ];

  for (const personData of demoPeople) {
    const { roles, ...person } = personData;
    const savedPerson = await prisma.person.upsert({
      where: {
        tenantId_identificacion: {
          tenantId: tenant.id,
          identificacion: person.identificacion
        }
      },
      update: { ...person, activo: true },
      create: {
        tenantId: tenant.id,
        companyId: company.id,
        ...person,
        activo: true,
        createdBy: user.id
      }
    });

    await prisma.personRole.createMany({
      data: roles.map((roleName) => ({ personId: savedPerson.id, role: roleName })),
      skipDuplicates: true
    });
  }

  const mainWarehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: "BOD-MAT" } },
    update: { name: "Bodega matriz", isDefault: true, status: "ACTIVE" },
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      branchId: branch.id,
      code: "BOD-MAT",
      name: "Bodega matriz",
      description: "Bodega principal del ERP demo",
      isDefault: true,
      createdBy: user.id
    }
  });

  await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: "BOD-TRF" } },
    update: { name: "Bodega transferencias", isDefault: false, status: "ACTIVE" },
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      branchId: branch.id,
      code: "BOD-TRF",
      name: "Bodega transferencias",
      description: "Bodega secundaria del ERP demo",
      isDefault: false,
      createdBy: user.id
    }
  });

  const productCategory = await prisma.category.upsert({
    where: { tenantId_type_name: { tenantId: tenant.id, type: "PRODUCT", name: "Productos demo" } },
    update: {},
    create: {
      tenantId: tenant.id,
      type: "PRODUCT",
      name: "Productos demo",
      description: "Productos inventariables de arranque"
    }
  });

  const subcategory = await prisma.subcategory.upsert({
    where: {
      tenantId_categoryId_name: {
        tenantId: tenant.id,
        categoryId: productCategory.id,
        name: "General"
      }
    },
    update: {},
    create: { tenantId: tenant.id, categoryId: productCategory.id, name: "General" }
  });

  const item = await prisma.catalogItem.upsert({
    where: { tenantId_internalCode: { tenantId: tenant.id, internalCode: "ERP-DEMO-001" } },
    update: {
      companyId: company.id,
      model: "DEMO-2026",
      unitPrice: "8.00",
      pvp: "12.50",
      pvp1: "12.50",
      pvp2: "11.50",
      pvp3: "10.50",
      finalPrice: "12.50",
      taxRateId: iva15.id,
      salePrice: "12.50",
      cost: "8.00"
    },
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      subcategoryId: subcategory.id,
      name: "Producto demo ERP",
      description: "Producto inicial para validar catalogo, inventario y ventas",
      internalCode: "ERP-DEMO-001",
      model: "DEMO-2026",
      unitPrice: "8.00",
      pvp: "12.50",
      pvp1: "12.50",
      pvp2: "11.50",
      pvp3: "10.50",
      finalPrice: "12.50",
      taxRateId: iva15.id,
      salePrice: "12.50",
      cost: "8.00"
    }
  });

  await prisma.stockBalance.upsert({
    where: {
      tenantId_warehouseId_catalogItemId: {
        tenantId: tenant.id,
        warehouseId: mainWarehouse.id,
        catalogItemId: item.id
      }
    },
    update: { onHand: "25.0000", averageCost: "8.000000" },
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      branchId: branch.id,
      warehouseId: mainWarehouse.id,
      catalogItemId: item.id,
      onHand: "25.0000",
      averageCost: "8.000000"
    }
  });

  console.log("Seed ERP listo");
  console.log(`Usuario: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
