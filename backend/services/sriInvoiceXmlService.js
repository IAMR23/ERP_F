function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function money(value, decimals = 2) {
  return Number(value || 0).toFixed(decimals);
}

function decimal(value, decimals = 6) {
  return Number(value || 0).toFixed(decimals);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function pad(value, length) {
  return String(value || "").padStart(length, "0").slice(-length);
}

function formatSriDate(value) {
  const date = value ? new Date(value) : new Date();
  const day = pad(date.getDate(), 2);
  const month = pad(date.getMonth() + 1, 2);
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatAuthorizationDate(value) {
  const date = value ? new Date(value) : new Date();
  const day = pad(date.getDate(), 2);
  const month = pad(date.getMonth() + 1, 2);
  const year = date.getFullYear();
  const hours = pad(date.getHours(), 2);
  const minutes = pad(date.getMinutes(), 2);
  const seconds = pad(date.getSeconds(), 2);

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function environmentCode(company) {
  return String(company?.sriEnvironment || "").toUpperCase() === "PRODUCTION" ? "2" : "1";
}

function environmentLabel(company) {
  return environmentCode(company) === "2" ? "PRODUCCION" : "PRUEBAS";
}

function documentCode(documentType) {
  if (documentType === "INVOICE") return "01";
  if (documentType === "CREDIT_NOTE") return "04";
  return "00";
}

function buyerIdentificationType(customer) {
  if (!customer) return "07";
  if (String(customer.identificacion || "").startsWith("999999999")) return "07";
  if (customer.tipoIdentificacion === "RUC") return "04";
  if (customer.tipoIdentificacion === "CEDULA") return "05";
  if (customer.tipoIdentificacion === "PASAPORTE") return "06";
  return "07";
}

function taxPercentageCode(rate) {
  const value = Number(rate || 0);

  if (value === 0) return "0";
  if (value === 5) return "5";
  if (value === 12) return "2";
  if (value === 14) return "3";
  if (value === 15) return "4";
  return "4";
}

function paymentSriCode(payment) {
  const code = String(payment?.paymentMethod?.code || "").toUpperCase();

  if (code.includes("CARD") || code.includes("TARJETA")) return "19";
  if (code.includes("TRANSFER") || code.includes("BANCO")) return "20";
  return "01";
}

function modulo11(base) {
  let factor = 2;
  let total = 0;

  for (let index = base.length - 1; index >= 0; index -= 1) {
    total += Number(base[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const result = 11 - (total % 11);
  if (result === 11) return "0";
  if (result === 10) return "1";
  return String(result);
}

function buildAccessKey(document) {
  const codDoc = documentCode(document.documentType);
  const ambiente = environmentCode(document.company);
  const ruc = pad(onlyDigits(document.company?.ruc), 13);
  const serie = `${pad(document.establishmentCode, 3)}${pad(document.emissionPoint, 3)}`;
  const secuencial = pad(document.sequential, 9);
  const codigoNumerico = pad(document.sequential, 8);
  const tipoEmision = "1";
  const base = `${formatSriDate(document.issueDate).replaceAll("/", "")}${codDoc}${ruc}${ambiente}${serie}${secuencial}${codigoNumerico}${tipoEmision}`;

  return `${base}${modulo11(base)}`;
}

function groupTaxes(lines) {
  const taxes = new Map();

  lines.forEach((line) => {
    const rate = Number(line.taxRatePercent || 0);
    const code = taxPercentageCode(rate);
    const current = taxes.get(code) || {
      codigo: "2",
      codigoPorcentaje: code,
      baseImponible: 0,
      valor: 0
    };

    current.baseImponible += Number(line.netSubtotal || 0);
    current.valor += Number(line.taxAmount || 0);
    taxes.set(code, current);
  });

  return [...taxes.values()];
}

function tag(name, value, indent = "    ") {
  return `${indent}<${name}>${xmlEscape(value)}</${name}>`;
}

function lineAdditionalXml(line) {
  const product = line.catalogItem || {};
  const details = [
    line.unit ? { nombre: "Unidad", valor: line.unit } : null,
    product.description ? { nombre: "Detalle", valor: product.description } : null
  ].filter(Boolean);

  if (!details.length) {
    return "";
  }

  return [
    "      <detallesAdicionales>",
    ...details.map(
      (detail) =>
        `        <detAdicional nombre="${xmlEscape(detail.nombre)}" valor="${xmlEscape(detail.valor)}"/>`
    ),
    "      </detallesAdicionales>"
  ].join("\n");
}

function buildSriInvoiceXml(document) {
  const accessKey = buildAccessKey(document);
  const company = document.company || {};
  const branch = document.branch || {};
  const customer = document.customer || {};
  const payment = document.payments?.[0];
  const totalTaxes = groupTaxes(document.lines || []);
  const buyerType = buyerIdentificationType(customer);
  const buyerIdentification =
    buyerType === "07" ? "9999999999999" : onlyDigits(customer.identificacion);
  const buyerName = buyerType === "07" ? "CONSUMIDOR FINAL" : customer.nombre;

  const detailsXml = (document.lines || [])
    .map((line) => {
      const product = line.catalogItem || {};
      const taxRate = Number(line.taxRatePercent || 0);

      return [
        "    <detalle>",
        tag("codigoPrincipal", product.internalCode || product.id || "SIN-CODIGO", "      "),
        tag("codigoAuxiliar", product.internalCode || product.id || "SIN-CODIGO", "      "),
        tag("descripcion", product.name || "Producto", "      "),
        tag("cantidad", decimal(line.quantity), "      "),
        tag("precioUnitario", decimal(line.unitPrice), "      "),
        tag("descuento", money(line.discountAmount), "      "),
        tag("precioTotalSinImpuesto", money(line.netSubtotal), "      "),
        lineAdditionalXml(line),
        "      <impuestos>",
        "        <impuesto>",
        tag("codigo", "2", "          "),
        tag("codigoPorcentaje", taxPercentageCode(taxRate), "          "),
        tag("tarifa", taxRate, "          "),
        tag("baseImponible", money(line.netSubtotal, 5), "          "),
        tag("valor", money(line.taxAmount), "          "),
        "        </impuesto>",
        "      </impuestos>",
        "    </detalle>"
      ].join("\n");
    })
    .join("\n");

  const totalTaxesXml = totalTaxes
    .map((tax) =>
      [
        "      <totalImpuesto>",
        tag("codigo", tax.codigo, "        "),
        tag("codigoPorcentaje", tax.codigoPorcentaje, "        "),
        tag("descuentoAdicional", "0", "        "),
        tag("baseImponible", money(tax.baseImponible), "        "),
        tag("valor", money(tax.valor, 5), "        "),
        "      </totalImpuesto>"
      ].join("\n")
    )
    .join("\n");

  const additionalFields = [
    customer.email ? { nombre: "Email", value: customer.email } : null,
    customer.telefono ? { nombre: "Telefono", value: customer.telefono } : null,
    document.description ? { nombre: "Descripcion", value: document.description } : null,
    document.reference ? { nombre: "Referencia", value: document.reference } : null,
    company.ruc ? { nombre: "RUC Proveedor", value: onlyDigits(company.ruc) } : null
  ].filter(Boolean);

  const additionalXml = additionalFields.length
    ? [
        "  <infoAdicional>",
        ...additionalFields.map(
          (field) => `    <campoAdicional nombre="${xmlEscape(field.nombre)}">${xmlEscape(field.value)}</campoAdicional>`
        ),
        "  </infoAdicional>"
      ].join("\n")
    : "";

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<factura id="comprobante" version="2.1.0">',
    "  <infoTributaria>",
    tag("ambiente", environmentCode(company), "    "),
    tag("tipoEmision", "1", "    "),
    tag("razonSocial", company.legalName || company.tradeName, "    "),
    tag("nombreComercial", company.tradeName || company.legalName, "    "),
    tag("ruc", onlyDigits(company.ruc), "    "),
    tag("claveAcceso", accessKey, "    "),
    tag("codDoc", "01", "    "),
    tag("estab", pad(document.establishmentCode, 3), "    "),
    tag("ptoEmi", pad(document.emissionPoint, 3), "    "),
    tag("secuencial", pad(document.sequential, 9), "    "),
    tag("dirMatriz", company.mainAddress || branch.address || "S/D", "    "),
    "  </infoTributaria>",
    "  <infoFactura>",
    tag("fechaEmision", formatSriDate(document.issueDate), "    "),
    tag("dirEstablecimiento", branch.address || company.mainAddress || "S/D", "    "),
    tag("obligadoContabilidad", company.accountingRequired ? "SI" : "NO", "    "),
    tag("tipoIdentificacionComprador", buyerType, "    "),
    tag("razonSocialComprador", buyerName, "    "),
    tag("identificacionComprador", buyerIdentification, "    "),
    customer.direccion ? tag("direccionComprador", customer.direccion, "    ") : "",
    tag("totalSinImpuestos", money(document.taxableSubtotal, 5), "    "),
    tag("totalDescuento", money(document.discountTotal), "    "),
    "    <totalConImpuestos>",
    totalTaxesXml,
    "    </totalConImpuestos>",
    tag("propina", "0", "    "),
    tag("importeTotal", money(document.total, 5), "    "),
    tag("moneda", company.currency || "DOLAR", "    "),
    "    <pagos>",
    "      <pago>",
    tag("formaPago", paymentSriCode(payment), "        "),
    tag("total", money(payment?.amount || document.total), "        "),
    tag("plazo", document.dueDays || 0, "        "),
    tag("unidadTiempo", "dias", "        "),
    "      </pago>",
    "    </pagos>",
    "  </infoFactura>",
    "  <detalles>",
    detailsXml,
    "  </detalles>",
    additionalXml,
    "</factura>"
  ].filter(Boolean).join("\n");

  const authorizationXml = [
    "<autorizacion>",
    tag("estado", document.sriStatus === "AUTHORIZED" ? "AUTORIZADO" : "PENDIENTE_REVISION", "  "),
    tag("numeroAutorizacion", document.sriAuthorizationNumber || accessKey, "  "),
    tag(
      "fechaAutorizacion",
      document.sriAuthorizationDate ? formatAuthorizationDate(document.sriAuthorizationDate) : "",
      "  "
    ),
    tag("ambiente", environmentLabel(company), "  "),
    "  <comprobante>",
    `<![CDATA[ ${xml} ]]>`,
    "  </comprobante>",
    "  <mensajes/>",
    "</autorizacion>"
  ].join("\n");

  return {
    accessKey,
    xml: authorizationXml
  };
}

module.exports = {
  buildSriInvoiceXml
};
