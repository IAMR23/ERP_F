const assert = require("node:assert/strict");
const test = require("node:test");
const { buildRidePdf } = require("../services/ridePdfService");
const {
  buildAccessKey,
  buildSriInvoiceXml,
  formatSriDate,
  modulo11,
  paymentSriCode,
  taxPercentageCode
} = require("../services/sriInvoiceXmlService");
const { validateInvoiceXml } = require("../services/sriXsdValidationService");

function invoice(overrides = {}) {
  return {
    id: "sale-1",
    tenantId: "tenant-1",
    companyId: "company-1",
    documentType: "INVOICE",
    issueDate: new Date("2026-08-31T12:00:00-05:00"),
    establishmentCode: "001",
    emissionPoint: "001",
    sequential: 1,
    documentNumber: "001-001-000000001",
    subtotal: 10,
    discountTotal: 0,
    taxableSubtotal: 10,
    taxTotal: 1.5,
    total: 11.5,
    sriStatus: "PENDING_REVIEW",
    company: {
      id: "company-1",
      legalName: "EMPRESA DEMO S.A.",
      tradeName: "EMPRESA DEMO",
      ruc: "1790012345001",
      mainAddress: "Av. Demo 123",
      accountingRequired: true,
      sriEnvironment: "TEST",
      currency: "USD"
    },
    branch: {
      id: "branch-1",
      address: "Sucursal Norte"
    },
    customer: {
      tipoIdentificacion: "RUC",
      identificacion: "1791234567001",
      nombre: "CLIENTE DEMO",
      direccion: "Calle Cliente",
      email: "cliente@example.com"
    },
    payments: [
      {
        amount: 11.5,
        paymentMethod: { code: "TRANSFER", name: "Transferencia bancaria" }
      }
    ],
    lines: [
      {
        quantity: 1,
        unitPrice: 10,
        unit: "Unidad",
        discountAmount: 0,
        netSubtotal: 10,
        taxRatePercent: 15,
        taxAmount: 1.5,
        lineTotal: 11.5,
        catalogItem: {
          id: "P001",
          internalCode: "P001",
          name: "Producto Demo",
          description: "Detalle Demo"
        }
      }
    ],
    ...overrides
  };
}

test("modulo 11 y clave de acceso generan 49 digitos", () => {
  const document = invoice();
  const accessKey = buildAccessKey(document);
  const base = accessKey.slice(0, 48);

  assert.equal(accessKey.length, 49);
  assert.match(accessKey, /^\d{49}$/);
  assert.equal(accessKey.at(-1), modulo11(base));
  assert.equal(accessKey.slice(8, 10), "01");
});

test("codigos IVA tabla 17 soportados y rechazo de tarifa desconocida", () => {
  assert.equal(taxPercentageCode(0), "0");
  assert.equal(taxPercentageCode(12), "2");
  assert.equal(taxPercentageCode(14), "3");
  assert.equal(taxPercentageCode(15), "4");
  assert.equal(taxPercentageCode(5), "5");
  assert.equal(taxPercentageCode(8), "8");
  assert.equal(taxPercentageCode(13), "10");
  assert.throws(() => taxPercentageCode(9), /tarifa IVA 9% no soportada/);
});

test("formas de pago distinguen debito, credito y transferencia", () => {
  assert.equal(paymentSriCode({ paymentMethod: { name: "Tarjeta de debito" } }), "16");
  assert.equal(paymentSriCode({ paymentMethod: { name: "Tarjeta de credito" } }), "19");
  assert.equal(paymentSriCode({ paymentMethod: { code: "TRANSFER" } }), "20");
});

test("pasaporte alfanumerico no pierde caracteres", () => {
  const { xml } = buildSriInvoiceXml(
    invoice({
      customer: {
        tipoIdentificacion: "PASAPORTE",
        identificacion: "AB123CD",
        nombre: "CLIENTE PASAPORTE"
      }
    })
  );

  assert.match(xml, /<tipoIdentificacionComprador>06<\/tipoIdentificacionComprador>/);
  assert.match(xml, /<identificacionComprador>AB123CD<\/identificacionComprador>/);
});

test("consumidor final permitido hasta USD 50 y rechazado sobre el limite", () => {
  const finalConsumer = invoice({
    total: 11.5,
    customer: { identificacion: "9999999999999", nombre: "Consumidor Final" }
  });
  const { xml } = buildSriInvoiceXml(finalConsumer);

  assert.match(xml, /<tipoIdentificacionComprador>07<\/tipoIdentificacionComprador>/);
  assert.match(xml, /<identificacionComprador>9999999999999<\/identificacionComprador>/);
  assert.throws(
    () =>
      buildSriInvoiceXml(
        invoice({
          subtotal: 51,
          taxableSubtotal: 51,
          taxTotal: 0,
          total: 51,
          customer: { identificacion: "9999999999999" },
          lines: [
            {
              ...invoice().lines[0],
              unitPrice: 51,
              netSubtotal: 51,
              taxRatePercent: 0,
              taxAmount: 0,
              lineTotal: 51
            }
          ]
        })
      ),
    /superiores a USD 50/
  );
});

test("fechas, decimales, agrupacion de impuestos y raiz factura cumplen XSD", () => {
  assert.equal(formatSriDate(new Date("2026-08-31T12:00:00-05:00")), "31/08/2026");

  const document = invoice({
    subtotal: 20,
    taxableSubtotal: 20,
    taxTotal: 1.5,
    total: 21.5,
    payments: [
      { amount: 10, paymentMethod: { name: "Efectivo" } },
      { amount: 11.5, paymentMethod: { name: "Tarjeta de credito" } }
    ],
    lines: [
      invoice().lines[0],
      {
        ...invoice().lines[0],
        catalogItem: { id: "P002", internalCode: "P002", name: "Producto 0" },
        taxRatePercent: 0,
        taxAmount: 0,
        lineTotal: 10
      }
    ]
  });
  const { xml } = buildSriInvoiceXml(document);

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<factura id="comprobante" version="2\.1\.0">/);
  assert.doesNotMatch(xml, /<autorizacion>/);
  assert.match(xml, /<cantidad>1\.000000<\/cantidad>/);
  assert.match(xml, /<precioUnitario>10\.000000<\/precioUnitario>/);
  assert.match(xml, /<codigoPorcentaje>4<\/codigoPorcentaje>[\s\S]*<codigoPorcentaje>0<\/codigoPorcentaje>/);
  assert.match(xml, /<formaPago>01<\/formaPago>[\s\S]*<formaPago>19<\/formaPago>/);
  validateInvoiceXml(xml);
});

test("rechaza diferencias mayores a un centavo", () => {
  assert.throws(() => buildSriInvoiceXml(invoice({ total: 12 })), /total de la factura no coincide/);
});

test("genera PDF RIDE con encabezado %PDF", async () => {
  const pdf = await buildRidePdf(
    invoice({
      sriStatus: "AUTHORIZED",
      sriAccessKey: "310820260117900123450011001001000000001000000011",
      sriAuthorizationNumber: "310820260117900123450011001001000000001000000011",
      sriAuthorizationDate: new Date("2026-08-31T18:00:00Z")
    })
  );

  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});
