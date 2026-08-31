const assert = require("node:assert/strict");
const test = require("node:test");
const { _test } = require("../services/documentService");

test("scopedSaleWhere aisla por tenantId, companyId y branchId", () => {
  const where = _test.scopedSaleWhere(
    {
      tenantId: "tenant-1",
      companyIds: ["company-1"],
      branchIds: ["branch-1"]
    },
    { id: "sale-1" }
  );

  assert.deepEqual(where, {
    AND: [
      { tenantId: "tenant-1" },
      { id: "sale-1" },
      { companyId: { in: ["company-1"] } },
      { branchId: { in: ["branch-1"] } }
    ]
  });
});

test("resolveSriNumbering usa la sucursal como punto de emision", () => {
  const numbering = _test.resolveSriNumbering(
    { establishmentCode: "001", emissionPoint: "100" },
    { branch: { sriEstablishmentCode: "100" } }
  );

  assert.deepEqual(numbering, {
    establishmentCode: "001",
    emissionPoint: "100"
  });
});

test("resolveSriNumbering corrige el formato antiguo sucursal-establecimiento", () => {
  const numbering = _test.resolveSriNumbering(
    { establishmentCode: "100", emissionPoint: "001" },
    { branch: { sriEstablishmentCode: "100" } }
  );

  assert.deepEqual(numbering, {
    establishmentCode: "001",
    emissionPoint: "100"
  });
});
