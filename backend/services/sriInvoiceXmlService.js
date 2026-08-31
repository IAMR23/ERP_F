const IVA_PERCENTAGE_CODES = new Map([
  [0, "0"],
  [12, "2"],
  [14, "3"],
  [15, "4"],
  [5, "5"],
  [8, "8"],
  [13, "10"]
]);

function sriXmlError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanText(value, maxLength = 300) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

function xmlEscape(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function numeric(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((numeric(value) + Number.EPSILON) * factor) / factor;
}

function amount(value, decimals = 2) {
  return round(value, decimals).toFixed(decimals);
}

function quantity(value) {
  return round(value, 6).toFixed(6);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function pad(value, length) {
  return String(value || "").padStart(length, "0").slice(-length);
}

function formatSriDate(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    throw sriXmlError("La fecha de emision no es valida");
  }

  return `${pad(date.getDate(), 2)}/${pad(date.getMonth() + 1, 2)}/${date.getFullYear()}`;
}

function accessKeyDate(value) {
  return formatSriDate(value).replace(/\//g, "");
}

function environmentCode(company) {
  return String(company?.sriEnvironment || "").toUpperCase() === "PRODUCTION" ? "2" : "1";
}

function environmentLabel(company) {
  return environmentCode(company) === "2" ? "PRODUCCION" : "PRUEBAS";
}

function modulo11(base) {
  let factor = 2;
  let total = 0;

  for (let index = base.length - 1; index >= 0; index -= 1) {
    total += Number(base[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }

  const verifier = 11 - (total % 11);
  if (verifier === 11) return "0";
  if (verifier === 10) return "1";
  return String(verifier);
}

function normalizeRuc(ruc) {
  const digits = onlyDigits(ruc);

  if (!/^\d{10}001$/.test(digits)) {
    throw sriXmlError("El RUC del emisor debe tener 13 digitos y terminar en 001");
  }

  return digits;
}

function validateCode(value, length, label) {
  const digits = onlyDigits(value);

  if (digits.length > length) {
    throw sriXmlError(`${label} debe tener ${length} digitos`);
  }

  return pad(digits, length);
}

function validateOptionalPattern(enabled, value, pattern, message) {
  const cleaned = cleanText(value);

  if (!enabled || !cleaned) {
    return "";
  }

  if (!pattern.test(cleaned)) {
    throw sriXmlError(message);
  }

  return cleaned;
}

function buildAccessKey(document) {
  const company = document.company || {};
  const ruc = normalizeRuc(company.ruc);
  const ambiente = environmentCode(company);
  const establishment = validateCode(document.establishmentCode, 3, "El establecimiento");
  const emissionPoint = validateCode(document.emissionPoint, 3, "El punto de emision");
  const sequential = validateCode(document.sequential, 9, "El secuencial");
  const numericCode = pad(onlyDigits(document.sriNumericCode || document.sequential), 8);
  const base = `${accessKeyDate(document.issueDate)}01${ruc}${ambiente}${establishment}${emissionPoint}${sequential}${numericCode}1`;

  return `${base}${modulo11(base)}`;
}

function taxPercentageCode(rate, lineLabel = "IVA") {
  const normalizedRate = round(rate, 2);
  const code = IVA_PERCENTAGE_CODES.get(normalizedRate);

  if (!code) {
    throw sriXmlError(`${lineLabel}: tarifa IVA ${normalizedRate}% no soportada por la tabla 17 del SRI`);
  }

  return code;
}

function paymentSriCode(payment) {
  const raw = `${payment?.paymentMethod?.code || ""} ${payment?.paymentMethod?.name || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (raw.includes("COMPENS")) return "15";
  if (raw.includes("DEBIT") || raw.includes("DEBITO")) return "16";
  if (raw.includes("CREDIT") || raw.includes("CREDITO")) return "19";
  if (raw.includes("TRANSFER") || raw.includes("BANCO") || raw.includes("FINANCIERO")) return "20";
  return "01";
}

function buyerIdentification(customer, total) {
  const type = String(customer?.tipoIdentificacion || "").toUpperCase();
  const rawIdentification = String(customer?.identificacion || "").trim();
  const isFinalConsumer =
    !customer ||
    rawIdentification === "9999999999999" ||
    rawIdentification === "999999999" ||
    type === "CONSUMIDOR_FINAL";

  if (isFinalConsumer) {
    if (round(total, 2) > 50) {
      throw sriXmlError("Las facturas superiores a USD 50 no pueden emitirse como consumidor final");
    }

    return {
      type: "07",
      identification: "9999999999999",
      name: "CONSUMIDOR FINAL"
    };
  }

  if (type === "RUC") {
    return { type: "04", identification: normalizeRuc(rawIdentification), name: cleanText(customer.nombre) };
  }

  if (type === "CEDULA") {
    const digits = onlyDigits(rawIdentification);

    if (!/^\d{10}$/.test(digits)) {
      throw sriXmlError("La cedula del comprador debe tener 10 digitos");
    }

    return { type: "05", identification: digits, name: cleanText(customer.nombre) };
  }

  if (type === "PASAPORTE") {
    const passport = cleanText(rawIdentification, 20);

    if (!/^[0-9A-Za-z]{1,20}$/.test(passport)) {
      throw sriXmlError("El pasaporte del comprador debe ser alfanumerico");
    }

    return { type: "06", identification: passport, name: cleanText(customer.nombre) };
  }

  if (type === "EXTERIOR") {
    return { type: "08", identification: cleanText(rawIdentification, 20), name: cleanText(customer.nombre) };
  }

  throw sriXmlError("Tipo de identificacion del comprador no soportado para factura electronica");
}

function tag(name, value, indent = "    ") {
  return `${indent}<${name}>${xmlEscape(value)}</${name}>`;
}

function optionalTag(name, value, indent = "    ") {
  const cleaned = cleanText(value);
  return cleaned ? tag(name, cleaned, indent) : "";
}

function lineAdditionalXml(line) {
  const product = line.catalogItem || {};
  const details = [
    product.description ? { nombre: "Detalle", valor: product.description } : null,
    line.reference ? { nombre: "Referencia", valor: line.reference } : null
  ].filter(Boolean).slice(0, 3);

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

function calculateLine(line, index) {
  const quantityValue = numeric(line.quantity);
  const unitPrice = numeric(line.unitPrice);
  const discount = round(line.discountAmount, 2);
  const base = round(quantityValue * unitPrice - discount, 2);
  const taxRate = round(line.taxRatePercent, 2);
  const tax = round(base * (taxRate / 100), 2);
  const storedBase = round(line.netSubtotal, 2);
  const storedTax = round(line.taxAmount, 2);

  if (Math.abs(storedBase - base) > 0.01) {
    throw sriXmlError(`La base imponible de la linea ${index + 1} no coincide con cantidad, precio y descuento`);
  }

  if (Math.abs(storedTax - tax) > 0.01) {
    throw sriXmlError(`El IVA de la linea ${index + 1} no coincide con la tarifa configurada`);
  }

  return {
    quantity: quantityValue,
    unitPrice,
    discount,
    base,
    tax,
    taxRate,
    taxCode: taxPercentageCode(taxRate, `Linea ${index + 1}`)
  };
}

function summarize(document) {
  const lines = (document.lines || []).map(calculateLine);
  const taxes = new Map();
  let totalSinImpuestos = 0;
  let totalDescuento = 0;
  let impuestoTotal = 0;

  lines.forEach((line) => {
    totalSinImpuestos += line.base;
    totalDescuento += line.discount;
    impuestoTotal += line.tax;
    const key = `2:${line.taxCode}`;
    const current = taxes.get(key) || {
      codigo: "2",
      codigoPorcentaje: line.taxCode,
      tarifa: line.taxRate,
      baseImponible: 0,
      valor: 0
    };
    current.baseImponible += line.base;
    current.valor += line.tax;
    taxes.set(key, current);
  });

  const propina = round(document.tip || 0, 2);
  const total = round(totalSinImpuestos + impuestoTotal + propina, 2);
  const storedTotal = round(document.total, 2);

  if (Math.abs(storedTotal - total) > 0.01) {
    throw sriXmlError("El total de la factura no coincide con subtotal + impuestos + propina");
  }

  return {
    lines,
    totalSinImpuestos: round(totalSinImpuestos, 2),
    totalDescuento: round(totalDescuento, 2),
    impuestoTotal: round(impuestoTotal, 2),
    propina,
    total,
    taxes: [...taxes.values()].map((tax) => ({
      ...tax,
      baseImponible: round(tax.baseImponible, 2),
      valor: round(tax.valor, 2)
    }))
  };
}

function totalTaxesXml(taxes) {
  return taxes
    .map((tax) =>
      [
        "      <totalImpuesto>",
        tag("codigo", tax.codigo, "        "),
        tag("codigoPorcentaje", tax.codigoPorcentaje, "        "),
        tag("baseImponible", amount(tax.baseImponible), "        "),
        tag("tarifa", amount(tax.tarifa), "        "),
        tag("valor", amount(tax.valor), "        "),
        "      </totalImpuesto>"
      ].join("\n")
    )
    .join("\n");
}

function paymentXml(document) {
  const payments = Array.isArray(document.payments) && document.payments.length
    ? document.payments
    : [{ amount: document.total, paymentMethod: { code: "01", name: "SIN UTILIZACION DEL SISTEMA FINANCIERO" } }];

  return [
    "    <pagos>",
    ...payments.map((payment) =>
      [
        "      <pago>",
        tag("formaPago", paymentSriCode(payment), "        "),
        tag("total", amount(payment.amount || document.total), "        "),
        document.dueDays ? tag("plazo", document.dueDays, "        ") : "",
        document.dueDays ? tag("unidadTiempo", "dias", "        ") : "",
        "      </pago>"
      ].filter(Boolean).join("\n")
    ),
    "    </pagos>"
  ].join("\n");
}

function additionalXml(document) {
  const company = document.company || {};
  const customer = document.customer || {};
  const fields = [
    customer.email ? { nombre: "Email", value: customer.email } : null,
    customer.telefono ? { nombre: "Telefono", value: customer.telefono } : null,
    document.description ? { nombre: "Descripcion", value: document.description } : null,
    document.reference ? { nombre: "Referencia", value: document.reference } : null,
    company.sriSoftwareProviderRuc
      ? { nombre: "RUC Proveedor", value: company.sriSoftwareProviderRuc }
      : null,
    company.largeTaxpayer && company.largeTaxpayerResolution
      ? { nombre: "Gran Contribuyente", value: company.largeTaxpayerResolution }
      : null
  ].filter(Boolean).slice(0, 15);

  if (!fields.length) {
    return "";
  }

  return [
    "  <infoAdicional>",
    ...fields.map(
      (field) => `    <campoAdicional nombre="${xmlEscape(field.nombre)}">${xmlEscape(field.value)}</campoAdicional>`
    ),
    "  </infoAdicional>"
  ].join("\n");
}

function buildSriInvoiceXml(document) {
  const accessKey = buildAccessKey(document);
  const company = document.company || {};
  const branch = document.branch || {};
  const summary = summarize(document);
  const buyer = buyerIdentification(document.customer, summary.total);
  const currency = String(company.currency || "USD").toUpperCase() === "USD" ? "DOLAR" : company.currency;
  const withholdingResolution = validateOptionalPattern(
    company.withholdingAgent,
    company.withholdingAgentResolution,
    /^[0-9]{1,8}$/,
    "La resolucion de agente de retencion debe ser numerica y tener maximo 8 digitos"
  );
  const specialContributorResolution = validateOptionalPattern(
    company.specialContributor,
    company.specialContributorResolution,
    /^[A-Za-z0-9]{3,13}$/,
    "La resolucion de contribuyente especial debe ser alfanumerica, sin guiones, de 3 a 13 caracteres"
  );

  if (company.sriSoftwareProviderRuc && !/^\d{10}001$/.test(company.sriSoftwareProviderRuc)) {
    throw sriXmlError("El RUC del proveedor del sistema debe tener 13 digitos y terminar en 001");
  }

  const detailsXml = (document.lines || [])
    .map((line, index) => {
      const product = line.catalogItem || {};
      const calculated = summary.lines[index];
      const codigoPrincipal = cleanText(product.internalCode || product.id || "SIN-CODIGO", 25);
      const codigoAuxiliar = cleanText(product.auxiliaryCode || product.codigoAuxiliar || "", 25);

      return [
        "    <detalle>",
        tag("codigoPrincipal", codigoPrincipal, "      "),
        codigoAuxiliar ? tag("codigoAuxiliar", codigoAuxiliar, "      ") : "",
        tag("descripcion", product.name || "Producto", "      "),
        optionalTag("unidadMedida", line.unit, "      "),
        tag("cantidad", quantity(calculated.quantity), "      "),
        tag("precioUnitario", amount(calculated.unitPrice, 6), "      "),
        tag("descuento", amount(calculated.discount), "      "),
        tag("precioTotalSinImpuesto", amount(calculated.base), "      "),
        lineAdditionalXml(line),
        "      <impuestos>",
        "        <impuesto>",
        tag("codigo", "2", "          "),
        tag("codigoPorcentaje", calculated.taxCode, "          "),
        tag("tarifa", amount(calculated.taxRate), "          "),
        tag("baseImponible", amount(calculated.base), "          "),
        tag("valor", amount(calculated.tax), "          "),
        "        </impuesto>",
        "      </impuestos>",
        "    </detalle>"
      ].filter(Boolean).join("\n");
    })
    .join("\n");

  const infoTributaria = [
    "  <infoTributaria>",
    tag("ambiente", environmentCode(company), "    "),
    tag("tipoEmision", "1", "    "),
    tag("razonSocial", company.legalName || company.tradeName, "    "),
    optionalTag("nombreComercial", company.tradeName || company.legalName, "    "),
    tag("ruc", normalizeRuc(company.ruc), "    "),
    tag("claveAcceso", accessKey, "    "),
    tag("codDoc", "01", "    "),
    tag("estab", validateCode(document.establishmentCode, 3, "El establecimiento"), "    "),
    tag("ptoEmi", validateCode(document.emissionPoint, 3, "El punto de emision"), "    "),
    tag("secuencial", validateCode(document.sequential, 9, "El secuencial"), "    "),
    tag("dirMatriz", company.mainAddress || branch.address || "S/D", "    "),
    withholdingResolution ? tag("agenteRetencion", withholdingResolution, "    ") : "",
    company.rimpe ? tag("contribuyenteRimpe", "CONTRIBUYENTE RÉGIMEN RIMPE", "    ") : "",
    "  </infoTributaria>"
  ].filter(Boolean).join("\n");

  const infoFactura = [
    "  <infoFactura>",
    tag("fechaEmision", formatSriDate(document.issueDate), "    "),
    tag("dirEstablecimiento", branch.address || company.mainAddress || "S/D", "    "),
    specialContributorResolution
      ? tag("contribuyenteEspecial", specialContributorResolution, "    ")
      : "",
    tag("obligadoContabilidad", company.accountingRequired ? "SI" : "NO", "    "),
    tag("tipoIdentificacionComprador", buyer.type, "    "),
    tag("razonSocialComprador", buyer.name || "CONSUMIDOR FINAL", "    "),
    tag("identificacionComprador", buyer.identification, "    "),
    optionalTag("direccionComprador", document.customer?.direccion, "    "),
    tag("totalSinImpuestos", amount(summary.totalSinImpuestos), "    "),
    tag("totalDescuento", amount(summary.totalDescuento), "    "),
    "    <totalConImpuestos>",
    totalTaxesXml(summary.taxes),
    "    </totalConImpuestos>",
    tag("propina", amount(summary.propina), "    "),
    tag("importeTotal", amount(summary.total), "    "),
    optionalTag("moneda", currency, "    "),
    paymentXml(document),
    "  </infoFactura>"
  ].filter(Boolean).join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<factura id="comprobante" version="2.1.0">',
    infoTributaria,
    infoFactura,
    "  <detalles>",
    detailsXml,
    "  </detalles>",
    additionalXml(document),
    "</factura>"
  ].filter(Boolean).join("\n");

  return {
    accessKey,
    xml,
    summary
  };
}

module.exports = {
  IVA_PERCENTAGE_CODES,
  buildAccessKey,
  buildSriInvoiceXml,
  environmentCode,
  environmentLabel,
  formatSriDate,
  modulo11,
  paymentSriCode,
  taxPercentageCode
};
