const fs = require("fs");
const path = require("path");
const libxml = require("libxmljs2");

const invoiceSchemaPath = path.resolve(
  __dirname,
  "../resources/sri/xsd/factura/2.1.0/factura_V2.1.0.xsd"
);

function validationError(message, details = []) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function formatXmlError(error) {
  return [error.message, error.line ? `linea ${error.line}` : null, error.column ? `columna ${error.column}` : null]
    .filter(Boolean)
    .join(" ");
}

function validateInvoiceXml(xml) {
  let xmlDocument;
  let xsdDocument;

  try {
    xmlDocument = libxml.parseXml(String(xml || ""), { noblanks: true });
  } catch (error) {
    throw validationError("El XML de factura no es valido", [formatXmlError(error)]);
  }

  try {
    xsdDocument = libxml.parseXml(fs.readFileSync(invoiceSchemaPath, "utf8"), {
      baseUrl: `${path.dirname(invoiceSchemaPath)}${path.sep}`
    });
  } catch (error) {
    throw validationError("No se pudo cargar el XSD oficial de factura 2.1.0", [formatXmlError(error)]);
  }

  const valid = xmlDocument.validate(xsdDocument);

  if (!valid) {
    const details = (xmlDocument.validationErrors || []).map(formatXmlError);
    throw validationError("El XML de factura no cumple el XSD oficial SRI 2.1.0", details);
  }

  return true;
}

module.exports = {
  invoiceSchemaPath,
  validateInvoiceXml
};
