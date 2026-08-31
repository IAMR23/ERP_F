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
    const document = await documentService.sendSriDocument(req.user, req.params.id);
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
  crearDocumento
};
