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

test("normalizeRequestedDocumentNumber acepta y descompone un numero SRI valido", () => {
  assert.deepEqual(
    _test.normalizeRequestedDocumentNumber("001-100-000000123", "001", "100"),
    {
      documentNumber: "001-100-000000123",
      sequential: 123
    }
  );
});

test("normalizeRequestedDocumentNumber rechaza un numero de otro punto de emision", () => {
  assert.throws(
    () => _test.normalizeRequestedDocumentNumber("001-200-000000123", "001", "100"),
    /debe iniciar con 001-100/
  );
});

test("reserveDocumentNumber rechaza un duplicado dentro del mismo tenant y empresa", async () => {
  let duplicateWhere;
  const tx = {
    sale: {
      findFirst: async ({ where }) => {
        duplicateWhere = where;
        return { id: "sale-existente" };
      }
    }
  };

  await assert.rejects(
    () =>
      _test.reserveDocumentNumber(
        tx,
        {
          tenantId: "tenant-1",
          companyId: "company-1",
          documentType: "INVOICE",
          establishmentCode: "001",
          emissionPoint: "100"
        },
        { documentNumber: "001-100-000000123", sequential: 123 }
      ),
    /Número de documento repetido: 001-100-000000123/
  );

  assert.deepEqual(duplicateWhere, {
    tenantId: "tenant-1",
    companyId: "company-1",
    documentType: "INVOICE",
    documentNumber: "001-100-000000123"
  });
});
