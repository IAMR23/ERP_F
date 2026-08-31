const crypto = require("crypto");
const forge = require("node-forge");
const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");
const { C14nCanonicalization } = require("xml-crypto/lib/c14n-canonicalization");

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const XADES_NS = "http://uri.etsi.org/01903/v1.3.2#";
const C14N_ALGORITHM = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ENVELOPED_SIGNATURE = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";

function signatureError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseP12(certificateBuffer, password) {
  if (!password) {
    throw signatureError("Configure SRI_P12_PASSWORD o FirmaPrueba con la contrasena del archivo .p12");
  }

  try {
    const p12Der = forge.util.createBuffer(certificateBuffer.toString("binary"));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    return forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  } catch {
    throw signatureError("No se pudo abrir el archivo .p12 con la contrasena configurada");
  }
}

function findPrivateKey(p12) {
  const shroudedBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
  const keyBag = [...(shroudedBags || []), ...(keyBags || [])].find((bag) => bag.key);

  if (!keyBag?.key) {
    throw signatureError("El archivo .p12 no contiene una clave privada valida para firmar");
  }

  return keyBag.key;
}

function findCertificate(p12) {
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const certBag = (certBags || []).find((bag) => bag.cert);

  if (!certBag?.cert) {
    throw signatureError("El archivo .p12 no contiene un certificado valido para firmar");
  }

  return certBag.cert;
}

function validateCertificate(cert, privateKey) {
  const now = new Date();

  if (cert.validity.notBefore > now || cert.validity.notAfter < now) {
    throw signatureError("El certificado de firma electronica no esta vigente");
  }

  const publicKey = cert.publicKey;

  if (!publicKey?.n || publicKey.n.bitLength() < 2048) {
    throw signatureError("El certificado debe usar RSA de al menos 2048 bits");
  }

  const probe = "sri-certificate-check";
  const md = forge.md.sha1.create();
  md.update(probe, "utf8");
  const signature = privateKey.sign(md);

  if (!publicKey.verify(md.digest().bytes(), signature)) {
    throw signatureError("La clave privada no corresponde al certificado del .p12");
  }
}

function pemBody(pem) {
  return pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
}

function canonicalizeXml(xml) {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  return new C14nCanonicalization().process(document.documentElement);
}

function digestXml(xml) {
  return crypto.createHash("sha1").update(canonicalizeXml(xml), "utf8").digest("base64");
}

function signXml(xml, privateKeyPem) {
  return crypto.createSign("RSA-SHA1").update(canonicalizeXml(xml), "utf8").sign(privateKeyPem, "base64");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeSerialNumber(cert) {
  return BigInt(`0x${cert.serialNumber}`).toString(10);
}

function issuerName(cert) {
  return cert.issuer.attributes
    .map((attribute) => `${attribute.shortName || attribute.name}=${attribute.value}`)
    .join(",");
}

function referenceXml({ uri, transforms = [], digestValue, type }) {
  return [
    `<ds:Reference URI="${uri}"${type ? ` Type="${type}"` : ""}>`,
    transforms.length
      ? `<ds:Transforms>${transforms
          .map((algorithm) => `<ds:Transform Algorithm="${algorithm}"/>`)
          .join("")}</ds:Transforms>`
      : "",
    `<ds:DigestMethod Algorithm="${SHA1}"/>`,
    `<ds:DigestValue>${digestValue}</ds:DigestValue>`,
    "</ds:Reference>"
  ].join("");
}

function extractInvoiceXml(xml) {
  const content = String(xml || "").trim();

  if (!/^<\?xml[\s\S]*?<factura|^<factura/.test(content)) {
    throw signatureError("El XML SRI debe tener factura como raiz para firmar");
  }

  if (/<autorizacion[\s>]/i.test(content)) {
    throw signatureError("El XML de envio al SRI no debe estar envuelto en autorizacion");
  }

  return content.replace(/<ds:Signature[\s\S]*?<\/ds:Signature>/, "").trim();
}

function verifySignatureReferenceCount(xml) {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  const references = xpath.select("//*[local-name(.)='SignedInfo']/*[local-name(.)='Reference']", document);
  const uris = references.map((node) => node.getAttribute("URI"));

  return {
    count: references.length,
    hasComprobante: uris.includes("#comprobante"),
    hasSignedProperties: uris.some((uri) => /^#SignedProperties/.test(uri || "")),
    hasKeyInfo: uris.some((uri) => /^#KeyInfo/.test(uri || ""))
  };
}

function signSriInvoiceXml(xml, certificateBuffer, password, options = {}) {
  const invoiceXml = extractInvoiceXml(xml);
  const p12 = parseP12(certificateBuffer, password);
  const privateKey = findPrivateKey(p12);
  const certificate = findCertificate(p12);
  validateCertificate(certificate, privateKey);

  const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
  const certificatePem = forge.pki.certificateToPem(certificate);
  const certificateDer = pemBody(certificatePem);
  const signingTime = (options.signingTime ? new Date(options.signingTime) : new Date()).toISOString();
  const suffix = options.idSuffix || Date.now();
  const signatureId = `Signature${suffix}`;
  const signedInfoId = `SignedInfo${suffix}`;
  const keyInfoId = `KeyInfo${suffix}`;
  const signedPropertiesId = `SignedProperties${suffix}`;
  const objectId = `Object${suffix}`;
  const certDigest = crypto.createHash("sha1").update(Buffer.from(certificateDer, "base64")).digest("base64");

  const keyInfoXml = [
    `<ds:KeyInfo xmlns:ds="${DS_NS}" Id="${keyInfoId}">`,
    "<ds:X509Data>",
    `<ds:X509Certificate>${certificateDer}</ds:X509Certificate>`,
    "</ds:X509Data>",
    "</ds:KeyInfo>"
  ].join("");

  const signedPropertiesXml = [
    `<etsi:SignedProperties xmlns:etsi="${XADES_NS}" xmlns:ds="${DS_NS}" Id="${signedPropertiesId}">`,
    "<etsi:SignedSignatureProperties>",
    `<etsi:SigningTime>${signingTime}</etsi:SigningTime>`,
    "<etsi:SigningCertificate>",
    "<etsi:Cert>",
    "<etsi:CertDigest>",
    `<ds:DigestMethod Algorithm="${SHA1}"/>`,
    `<ds:DigestValue>${certDigest}</ds:DigestValue>`,
    "</etsi:CertDigest>",
    "<etsi:IssuerSerial>",
    `<ds:X509IssuerName>${escapeXml(issuerName(certificate))}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber>${normalizeSerialNumber(certificate)}</ds:X509SerialNumber>`,
    "</etsi:IssuerSerial>",
    "</etsi:Cert>",
    "</etsi:SigningCertificate>",
    "</etsi:SignedSignatureProperties>",
    "</etsi:SignedProperties>"
  ].join("");

  const objectXml = [
    `<ds:Object Id="${objectId}">`,
    `<etsi:QualifyingProperties xmlns:etsi="${XADES_NS}" Target="#${signatureId}">`,
    signedPropertiesXml,
    "</etsi:QualifyingProperties>",
    "</ds:Object>"
  ].join("");

  const referencesXml = [
    referenceXml({
      uri: "#comprobante",
      transforms: [ENVELOPED_SIGNATURE, C14N_ALGORITHM],
      digestValue: digestXml(invoiceXml)
    }),
    referenceXml({
      uri: `#${signedPropertiesId}`,
      type: "http://uri.etsi.org/01903#SignedProperties",
      transforms: [C14N_ALGORITHM],
      digestValue: digestXml(signedPropertiesXml)
    }),
    referenceXml({
      uri: `#${keyInfoId}`,
      transforms: [C14N_ALGORITHM],
      digestValue: digestXml(keyInfoXml)
    })
  ].join("");

  const signedInfoXml = [
    `<ds:SignedInfo xmlns:ds="${DS_NS}" Id="${signedInfoId}">`,
    `<ds:CanonicalizationMethod Algorithm="${C14N_ALGORITHM}"/>`,
    `<ds:SignatureMethod Algorithm="${RSA_SHA1}"/>`,
    referencesXml,
    "</ds:SignedInfo>"
  ].join("");
  const signatureValue = signXml(signedInfoXml, privateKeyPem);
  const signatureXml = [
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${signatureId}">`,
    signedInfoXml,
    `<ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
    keyInfoXml,
    objectXml,
    "</ds:Signature>"
  ].join("");

  return invoiceXml.replace(/<\/factura>\s*$/i, `${signatureXml}</factura>`);
}

module.exports = {
  signSriInvoiceXml,
  verifySignatureReferenceCount
};
