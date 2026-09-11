const assert = require("node:assert/strict");
const test = require("node:test");
const { _test } = require("../services/documentService");
const { assertAuthorizedForEmail, deliverInvoiceEmail } = require("../services/invoiceEmailService");

function invoice(overrides = {}) {
  return {
    documentType: "INVOICE",
    sriStatus: "PENDING_REVIEW",
    sriSignedAt: null,
    sriSignatureError: null,
    sriSentAt: null,
    sriReceptionError: null,
    sriAuthorizationNumber: null,
    sriAuthorizationDate: null,
    sriAuthorizationError: null,
    customerEmailSentAt: null,
    customerEmailError: null,
    ...overrides
  };
}

test("calcula los cuatro indicadores con evidencia persistida independiente", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const result = _test.calculateElectronicMilestones(
    invoice({
      sriStatus: "AUTHORIZED",
      sriSignedAt: now,
      sriSentAt: now,
      sriAuthorizationNumber: "123",
      sriAuthorizationDate: now,
      customerEmailSentAt: now
    })
  );
  assert.deepEqual(Object.values(result).map((item) => item.state), [
    "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED"
  ]);
});

test("documentos no electronicos muestran No aplica", () => {
  const result = _test.calculateElectronicMilestones({ documentType: "SALES_NOTE" });
  assert.ok(Object.values(result).every((item) => item.state === "NOT_APPLICABLE"));
});

test("una factura autorizada con correo fallido sigue autorizada", () => {
  const now = new Date();
  const document = invoice({
    sriStatus: "AUTHORIZED",
    sriAuthorizationNumber: "123",
    sriAuthorizationDate: now,
    customerEmailError: "SMTP rechazado"
  });
  const result = _test.calculateElectronicMilestones(document);
  assert.equal(document.sriStatus, "AUTHORIZED");
  assert.equal(result.authorized.state, "COMPLETED");
  assert.equal(result.emailed.state, "ERROR");
});

test("SMTP fallido no marca el correo como enviado", async () => {
  const now = new Date();
  const document = invoice({
    sriStatus: "AUTHORIZED",
    sriAuthorizationNumber: "123",
    sriAuthorizationDate: now,
    documentNumber: "001-001-000000001",
    customer: { email: "cliente@example.com" },
    company: { tradeName: "Empresa" },
    sriAuthorizationXml: "<autorizacion />"
  });
  await assert.rejects(
    () => deliverInvoiceEmail(document, {
      from: "facturas@example.com",
      buildPdf: async () => Buffer.from("PDF"),
      transporter: { sendMail: async () => { throw new Error("SMTP fallido"); } }
    }),
    /SMTP fallido/
  );
  assert.equal(_test.calculateElectronicMilestones(document).emailed.state, "PENDING");
});

test("no intenta enviar una factura que aun no esta autorizada", async () => {
  let calls = 0;
  const document = invoice({ customer: { email: "cliente@example.com" } });
  assert.throws(() => assertAuthorizedForEmail(document), /factura autorizada/);
  await assert.rejects(
    () => deliverInvoiceEmail(document, { transporter: { sendMail: async () => { calls += 1; } } }),
    /factura autorizada/
  );
  assert.equal(calls, 0);
});

test("las consultas y envios quedan aislados por tenant, empresa y sucursal", () => {
  const where = _test.scopedSaleWhere(
    { tenantId: "tenant-a", companyIds: ["company-a"], branchIds: ["branch-a"] },
    { id: "document-a" }
  );
  assert.deepEqual(where.AND, [
    { tenantId: "tenant-a" },
    { id: "document-a" },
    { companyId: { in: ["company-a"] } },
    { branchId: { in: ["branch-a"] } }
  ]);
});

test("evita envio duplicado salvo reenvio explicito", () => {
  const sent = invoice({
    sriStatus: "AUTHORIZED",
    sriAuthorizationNumber: "123",
    sriAuthorizationDate: new Date(),
    customerEmailSentAt: new Date()
  });
  assert.throws(() => _test.assertEmailSendAllowed(sent, false), /ya fue enviada/);
  assert.doesNotThrow(() => _test.assertEmailSendAllowed(sent, true));
});

test("RECIBIDA activa recepcion pero no autorizacion", () => {
  const result = _test.calculateElectronicMilestones(invoice({ sriSentAt: new Date(), sriStatus: "SENT" }));
  assert.equal(result.received.state, "COMPLETED");
  assert.equal(result.authorized.state, "PENDING");
});

test("AUTORIZADO con numero y fecha activa autorizacion", () => {
  const result = _test.calculateElectronicMilestones(invoice({
    sriStatus: "AUTHORIZED",
    sriAuthorizationNumber: "123",
    sriAuthorizationDate: new Date()
  }));
  assert.equal(result.authorized.state, "COMPLETED");
});
