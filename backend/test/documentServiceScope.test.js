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
