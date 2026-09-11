const nodemailer = require("nodemailer");
const env = require("../config/env");
const { buildRidePdf, documentParts } = require("./ridePdfService");

function smtpConfiguration() {
  const smtp = env.smtp || {};

  if (!smtp.host || !smtp.from) {
    const error = new Error("Configure SMTP_HOST y SMTP_FROM para enviar facturas por correo");
    error.statusCode = 400;
    throw error;
  }

  return smtp;
}

function createTransport() {
  const smtp = smtpConfiguration();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user
      ? { auth: { user: smtp.user, pass: smtp.password } }
      : {})
  });
}

function assertAuthorizedForEmail(document) {
  if (
    document?.documentType !== "INVOICE" ||
    document?.sriStatus !== "AUTHORIZED" ||
    !document?.sriAuthorizationNumber ||
    !document?.sriAuthorizationDate
  ) {
    const error = new Error("Solo se puede enviar una factura autorizada por el SRI");
    error.statusCode = 400;
    throw error;
  }
}

async function deliverInvoiceEmail(document, options = {}) {
  assertAuthorizedForEmail(document);
  const recipient = String(options.recipient || document.customer?.email || "").trim();

  if (!recipient) {
    const error = new Error("El cliente no tiene un correo registrado");
    error.statusCode = 400;
    throw error;
  }

  const ride = await (options.buildPdf || buildRidePdf)(document);
  const transporter = options.transporter || createTransport();
  const companyName = document.company?.tradeName || document.company?.legalName || "la empresa";
  const number = document.documentNumber || document.sriAuthorizationNumber;
  const xml = document.sriAuthorizationXml || document.sriXml;

  if (!xml) {
    const error = new Error("No existe XML autorizado para adjuntar");
    error.statusCode = 400;
    throw error;
  }

  const result = await transporter.sendMail({
    from: options.from || smtpConfiguration().from,
    to: recipient,
    subject: `Factura ${number} - ${companyName}`,
    text: `Estimado cliente,\n\nAdjuntamos su factura ${number}, emitida por ${companyName}, junto con el RIDE y el XML autorizado por el SRI.\n\nSaludos cordiales.`,
    attachments: [
      {
        filename: `RIDE-${documentParts(document).number}.pdf`,
        content: ride,
        contentType: "application/pdf"
      },
      {
        filename: `FACTURA-${documentParts(document).number}.xml`,
        content: Buffer.from(xml, "utf8"),
        contentType: "application/xml"
      }
    ]
  });

  if (!result?.accepted?.length) {
    throw new Error("El servidor SMTP no confirmo la recepcion del correo");
  }

  return { recipient, messageId: result.messageId || null };
}

module.exports = {
  assertAuthorizedForEmail,
  createTransport,
  deliverInvoiceEmail,
  smtpConfiguration
};
