const PDFDocument = require("pdfkit");
const { readStoredFile } = require("./imageService");
const { environmentLabel, taxPercentageCode } = require("./sriInvoiceXmlService");

function money(value) {
  return Number(value || 0).toFixed(2);
}

function text(value, fallback = "-") {
  return String(value || fallback);
}

function dateText(value) {
  return value ? new Date(value).toLocaleString("es-EC") : "-";
}

function documentParts(document) {
  const establishment = String(document.establishmentCode || "001").padStart(3, "0");
  const emissionPoint = String(document.emissionPoint || "001").padStart(3, "0");
  const sequential = String(document.sequential || "0").padStart(9, "0");
  return { establishment, emissionPoint, sequential, number: `${establishment}-${emissionPoint}-${sequential}` };
}

function paymentCode(payment) {
  const raw = `${payment?.paymentMethod?.code || ""} ${payment?.paymentMethod?.name || ""}`.toUpperCase();
  if (raw.includes("DEBIT")) return "16";
  if (raw.includes("CREDIT")) return "19";
  if (raw.includes("TRANSFER") || raw.includes("BANCO")) return "20";
  if (raw.includes("COMPENS")) return "15";
  return "01";
}

function taxBuckets(document) {
  const buckets = new Map();

  for (const line of document.lines || []) {
    const rate = Number(line.taxRatePercent || 0);
    const code = taxPercentageCode(rate);
    const current = buckets.get(code) || { rate, base: 0, tax: 0 };
    current.base += Number(line.netSubtotal || 0);
    current.tax += Number(line.taxAmount || 0);
    buckets.set(code, current);
  }

  return [...buckets.values()].sort((a, b) => b.rate - a.rate);
}

function writePair(doc, label, value, x, y, width = 230) {
  doc.font("Helvetica-Bold").fontSize(8).text(label, x, y, { width });
  doc.font("Helvetica").fontSize(9).text(text(value), x, y + 10, { width });
}

function drawHeader(doc, document) {
  const company = document.company || {};
  const branch = document.branch || {};
  const parts = documentParts(document);

  doc.font("Helvetica-Bold").fontSize(12).text(text(company.legalName || company.tradeName), 36, 34, {
    width: 270
  });
  doc.font("Helvetica").fontSize(9).text(text(company.tradeName || company.legalName), 36, 52, { width: 270 });
  doc.fontSize(8).text(`Dir. matriz: ${text(company.mainAddress)}`, 36, 68, { width: 270 });
  doc.text(`Dir. establecimiento: ${text(branch.address || company.mainAddress)}`, 36, 82, { width: 270 });

  doc.roundedRect(330, 32, 230, 164, 4).stroke("#9ca3af");
  writePair(doc, "RUC", company.ruc, 344, 44, 200);
  doc.font("Helvetica-Bold").fontSize(16).text("FACTURA", 344, 70, { width: 200 });
  writePair(doc, "No.", parts.number, 344, 96, 200);
  writePair(doc, "Numero de autorizacion", document.sriAuthorizationNumber || document.sriAccessKey, 344, 122, 200);
  writePair(doc, "Fecha autorizacion", dateText(document.sriAuthorizationDate), 344, 148, 200);
  writePair(doc, "Ambiente / Emision", `${environmentLabel(company)} / NORMAL`, 344, 174, 200);

  doc.font("Helvetica-Bold").fontSize(8).text("Clave de acceso", 36, 210);
  doc.font("Courier").fontSize(9).text(text(document.sriAccessKey), 36, 222, { width: 524 });

  if (environmentLabel(company) === "PRUEBAS") {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#b45309").text(
      "AMBIENTE DE PRUEBAS - COMPROBANTE SIN VALIDEZ TRIBUTARIA",
      36,
      242,
      { width: 524, align: "center" }
    );
    doc.fillColor("#111827");
  }
}

function drawBuyer(doc, document, y) {
  const customer = document.customer || {};
  doc.roundedRect(36, y, 524, 54, 4).stroke("#d1d5db");
  writePair(doc, "Razon social comprador", customer.nombre, 46, y + 10, 250);
  writePair(doc, "Identificacion", customer.identificacion, 310, y + 10, 110);
  writePair(doc, "Fecha emision", dateText(document.issueDate), 430, y + 10, 110);
  return y + 70;
}

function drawTableHeader(doc, y) {
  const columns = [
    ["Cod.", 36, 54],
    ["Cod. aux.", 90, 54],
    ["Cant.", 144, 50],
    ["Descripcion", 194, 166],
    ["P. unit.", 360, 58],
    ["Desc.", 418, 58],
    ["Total s/imp.", 476, 84]
  ];

  doc.rect(36, y, 524, 20).fillAndStroke("#f3f4f6", "#d1d5db");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7);
  columns.forEach(([label, x, width]) => doc.text(label, x + 4, y + 6, { width }));
  return y + 20;
}

function ensurePage(doc, y, needed, document) {
  if (y + needed <= 760) {
    return y;
  }

  doc.addPage();
  drawHeader(doc, document);
  return drawTableHeader(doc, 276);
}

async function addLogo(doc, company) {
  if (!company?.logoObjectKey) {
    return;
  }

  try {
    const image = await readStoredFile(company.logoObjectKey);
    doc.image(image, 36, 110, { fit: [120, 70] });
  } catch {
    // Logo is optional for RIDE generation.
  }
}

async function buildRidePdf(document) {
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawHeader(doc, document);
  await addLogo(doc, document.company);
  let y = drawBuyer(doc, document, 270);
  y = drawTableHeader(doc, y);

  doc.font("Helvetica").fontSize(7);
  for (const line of document.lines || []) {
    y = ensurePage(doc, y, 34, document);
    const product = line.catalogItem || {};
    const rowY = y;
    doc.rect(36, rowY, 524, 32).stroke("#e5e7eb");
    doc.text(text(product.internalCode), 40, rowY + 6, { width: 46 });
    doc.text(text(product.auxiliaryCode, ""), 94, rowY + 6, { width: 46 });
    doc.text(Number(line.quantity || 0).toFixed(6), 148, rowY + 6, { width: 42, align: "right" });
    doc.text(`${text(product.name || "Producto")} ${line.unit ? `(${line.unit})` : ""}`, 198, rowY + 6, {
      width: 154
    });
    doc.text(money(line.unitPrice), 364, rowY + 6, { width: 48, align: "right" });
    doc.text(money(line.discountAmount), 422, rowY + 6, { width: 48, align: "right" });
    doc.text(money(line.netSubtotal), 480, rowY + 6, { width: 74, align: "right" });
    y += 32;
  }

  y = ensurePage(doc, y, 210, document) + 16;
  doc.font("Helvetica-Bold").fontSize(9).text("Informacion adicional", 36, y);
  doc.font("Helvetica").fontSize(8);
  y += 14;
  const additional = [
    document.description ? ["Descripcion", document.description] : null,
    document.reference ? ["Referencia", document.reference] : null,
    document.company?.sriSoftwareProviderRuc ? ["RUC Proveedor", document.company.sriSoftwareProviderRuc] : null
  ].filter(Boolean);
  additional.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, 36, y, { width: 260 });
    y += 12;
  });

  y += 8;
  doc.font("Helvetica-Bold").fontSize(9).text("Formas de pago", 36, y);
  y += 14;
  doc.font("Helvetica").fontSize(8);
  (document.payments || []).forEach((payment) => {
    doc.text(`${paymentCode(payment)} - ${text(payment.paymentMethod?.name)}: $${money(payment.amount)}`, 36, y, {
      width: 260
    });
    y += 12;
  });

  const totalsX = 330;
  let totalsY = Math.max(y - 70, 520);
  doc.font("Helvetica-Bold").fontSize(9).text("Totales", totalsX, totalsY);
  totalsY += 16;
  const rows = [
    ...taxBuckets(document).map((bucket) => [`Subtotal IVA ${bucket.rate}%`, bucket.base]),
    ["Subtotal sin impuestos", document.taxableSubtotal],
    ["Descuento", document.discountTotal],
    ...taxBuckets(document).map((bucket) => [`IVA ${bucket.rate}%`, bucket.tax]),
    ["Propina", 0],
    ["Valor total", document.total]
  ];

  rows.forEach(([label, value], index) => {
    doc.font(index === rows.length - 1 ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    doc.text(label, totalsX, totalsY, { width: 130 });
    doc.text(`$${money(value)}`, totalsX + 140, totalsY, { width: 90, align: "right" });
    totalsY += 13;
  });

  const legends = [
    document.company?.rimpe ? "CONTRIBUYENTE REGIMEN RIMPE" : null,
    document.company?.withholdingAgent && document.company?.withholdingAgentResolution
      ? `Agente de retencion: ${document.company.withholdingAgentResolution}`
      : null,
    document.company?.specialContributor && document.company?.specialContributorResolution
      ? `Contribuyente especial: ${document.company.specialContributorResolution}`
      : null,
    document.company?.largeTaxpayer && document.company?.largeTaxpayerResolution
      ? `Gran contribuyente: ${document.company.largeTaxpayerResolution}`
      : null
  ].filter(Boolean);

  if (legends.length) {
    doc.font("Helvetica").fontSize(8).text(legends.join(" | "), 36, 760, { width: 524 });
  }

  doc.end();
  return done;
}

module.exports = {
  buildRidePdf,
  documentParts
};
