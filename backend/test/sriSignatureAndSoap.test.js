const assert = require("node:assert/strict");
const test = require("node:test");
const forge = require("node-forge");
const { buildSriInvoiceXml } = require("../services/sriInvoiceXmlService");
const { signSriInvoiceXml, verifySignatureReferenceCount } = require("../services/sriSignatureService");
const {
  parseAuthorizationResponse,
  parseReceptionResponse,
  sriEndpoints
} = require("../services/sriSoapClient");
const { validateInvoiceXml } = require("../services/sriXsdValidationService");

function createTestP12(password) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date("2026-01-01T00:00:00Z");
  cert.validity.notAfter = new Date("2027-01-01T00:00:00Z");
  const attrs = [{ name: "commonName", value: "Certificado Test" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des"
  });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
}

function invoice() {
  return {
    documentType: "INVOICE",
    issueDate: new Date("2026-08-31T12:00:00-05:00"),
    establishmentCode: "001",
    emissionPoint: "001",
    sequential: 1,
    subtotal: 10,
    discountTotal: 0,
    taxableSubtotal: 10,
    taxTotal: 1.5,
    total: 11.5,
    company: {
      legalName: "EMPRESA DEMO S.A.",
      tradeName: "EMPRESA DEMO",
      ruc: "1790012345001",
      mainAddress: "Av. Demo 123",
      accountingRequired: true,
      sriEnvironment: "TEST",
      currency: "USD"
    },
    branch: { address: "Sucursal Norte" },
    customer: {
      tipoIdentificacion: "RUC",
      identificacion: "1791234567001",
      nombre: "CLIENTE DEMO"
    },
    payments: [{ amount: 11.5, paymentMethod: { name: "Efectivo" } }],
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
        catalogItem: { id: "P001", internalCode: "P001", name: "Producto Demo" }
      }
    ]
  };
}

test("firma XAdES-BES incluye tres referencias y pasa XSD", () => {
  const password = "test-password";
  const { xml } = buildSriInvoiceXml(invoice());
  const signedXml = signSriInvoiceXml(xml, createTestP12(password), password, {
    idSuffix: "Test",
    signingTime: "2026-08-31T17:00:00.000Z"
  });
  const references = verifySignatureReferenceCount(signedXml);

  assert.equal(references.count, 3);
  assert.equal(references.hasComprobante, true);
  assert.equal(references.hasSignedProperties, true);
  assert.equal(references.hasKeyInfo, true);
  assert.match(signedXml, /<ds:KeyInfo[\s\S]*<ds:X509Certificate>/);
  assert.match(signedXml, /<etsi:SignedProperties/);
  validateInvoiceXml(signedXml);
});

test("interpreta respuestas SOAP de recepcion", () => {
  const recibida = parseReceptionResponse(`
    <RespuestaRecepcionComprobante><estado>RECIBIDA</estado></RespuestaRecepcionComprobante>
  `);
  const devuelta = parseReceptionResponse(`
    <RespuestaRecepcionComprobante>
      <estado>DEVUELTA</estado>
      <comprobantes><comprobante><mensajes><mensaje>
        <identificador>35</identificador><mensaje>ARCHIVO NO CUMPLE ESTRUCTURA XML</mensaje><tipo>ERROR</tipo>
      </mensaje></mensajes></comprobante></comprobantes>
    </RespuestaRecepcionComprobante>
  `);

  assert.equal(recibida.estado, "RECIBIDA");
  assert.equal(devuelta.estado, "DEVUELTA");
  assert.equal(devuelta.messages[0].identificador, "35");
});

test("interpreta respuestas SOAP de autorizacion", () => {
  const autorizado = parseAuthorizationResponse(`
    <RespuestaAutorizacionComprobante>
      <autorizaciones><autorizacion>
        <estado>AUTORIZADO</estado>
        <numeroAutorizacion>3108202601179001234500110010010000000010000000111</numeroAutorizacion>
        <fechaAutorizacion>2026-08-31T17:00:00-05:00</fechaAutorizacion>
      </autorizacion></autorizaciones>
    </RespuestaAutorizacionComprobante>
  `);
  const rechazado = parseAuthorizationResponse(`
    <RespuestaAutorizacionComprobante>
      <autorizaciones><autorizacion>
        <estado>NO AUTORIZADO</estado>
        <mensajes><mensaje><identificador>43</identificador><mensaje>CLAVE ACCESO REGISTRADA</mensaje></mensaje></mensajes>
      </autorizacion></autorizaciones>
    </RespuestaAutorizacionComprobante>
  `);

  assert.equal(autorizado.estado, "AUTORIZADO");
  assert.equal(autorizado.numeroAutorizacion.length, 49);
  assert.equal(rechazado.estado, "NO AUTORIZADO");
  assert.equal(rechazado.messages[0].identificador, "43");
});

test("selecciona endpoints SRI de pruebas y produccion", () => {
  assert.match(sriEndpoints({ sriEnvironment: "TEST" }).reception, /celcer\.sri\.gob\.ec/);
  assert.match(sriEndpoints({ sriEnvironment: "PRODUCTION" }).authorization, /cel\.sri\.gob\.ec/);
});
