const documentService = require("../services/documentService");

async function listarDocumentos(req, res, next) {
  try {
    const result = await documentService.listDocuments(req.user, req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function obtenerDocumento(req, res, next) {
  try {
    const document = await documentService.getDocument(req.user, req.params.id);
    return res.json({ document });
  } catch (error) {
    return next(error);
  }
}

async function validarFacturaNotaCredito(req, res, next) {
  try {
    const draft = await documentService.validateCreditNoteInvoice(req.user, req.body);
    return res.json({ draft });
  } catch (error) {
    return next(error);
  }
}

async function validarDocumentoSri(req, res, next) {
  try {
    const document = await documentService.validateSriDocument(req.user, req.params.id);
    return res.json({ document });
  } catch (error) {
    return next(error);
  }
}

async function enviarDocumentoSri(req, res, next) {
  try {
    const result = await documentService.sendSriDocument(req.user, req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function consultarAutorizacionSri(req, res, next) {
  try {
    const result = await documentService.consultSriAuthorization(req.user, req.params.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function descargarRidePdf(req, res, next) {
  try {
    const { pdf, fileName } = await documentService.getRidePdf(req.user, req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(pdf);
  } catch (error) {
    return next(error);
  }
}

async function enviarFacturaCorreo(req, res, next) {
  try {
    const document = await documentService.sendAuthorizedInvoiceEmail(req.user, req.params.id, {
      force: Boolean(req.body?.force)
    });
    return res.json({ document });
  } catch (error) {
    return next(error);
  }
}

async function cambiarBodegaDocumento(req, res, next) {
  try {
    const document = await documentService.updateDocumentWarehouse(
      req.user,
      req.params.id,
      req.body?.warehouseId
    );
    return res.json({ document });
  } catch (error) {
    return next(error);
  }
}

async function crearDocumento(req, res, next) {
  try {
    const document = await documentService.createDocument(req.user, req.body);
    return res.status(201).json({ document });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarDocumentos,
  obtenerDocumento,
  validarFacturaNotaCredito,
  validarDocumentoSri,
  enviarDocumentoSri,
  consultarAutorizacionSri,
  descargarRidePdf,
  enviarFacturaCorreo,
  cambiarBodegaDocumento,
  crearDocumento
};
