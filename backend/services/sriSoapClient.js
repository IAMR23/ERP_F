const soap = require("soap");
const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");

const ENDPOINTS = {
  TEST: {
    reception:
      "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    authorization:
      "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
  },
  PRODUCTION: {
    reception:
      "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    authorization:
      "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
  }
};

function soapError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function sriEnvironmentKey(company) {
  return String(company?.sriEnvironment || "").toUpperCase() === "PRODUCTION" ? "PRODUCTION" : "TEST";
}

function sriEndpoints(company) {
  return ENDPOINTS[sriEnvironmentKey(company)];
}

function text(node, path = ".") {
  const selected = xpath.select1(path, node);
  return selected?.textContent?.trim() || "";
}

function collectMessages(root) {
  return xpath.select("//*[local-name(.)='mensaje']", root).map((message) => ({
    identificador: text(message, "*[local-name(.)='identificador']"),
    mensaje: text(message, "*[local-name(.)='mensaje']"),
    informacionAdicional: text(message, "*[local-name(.)='informacionAdicional']"),
    tipo: text(message, "*[local-name(.)='tipo']")
  }));
}

function parseReceptionResponse(response) {
  const rawXml = typeof response === "string" ? response : response?.rawXml || response?.xml || "";
  const estado =
    response?.RespuestaRecepcionComprobante?.estado ||
    response?.estado ||
    (rawXml ? text(new DOMParser().parseFromString(rawXml, "text/xml"), "//*[local-name(.)='estado']") : "");
  const messages = rawXml
    ? collectMessages(new DOMParser().parseFromString(rawXml, "text/xml"))
    : collectMessagesFromObject(response);

  return {
    estado: String(estado || "").toUpperCase(),
    messages,
    rawXml
  };
}

function parseAuthorizationResponse(response) {
  const rawXml = typeof response === "string" ? response : response?.rawXml || response?.xml || "";
  const document = rawXml ? new DOMParser().parseFromString(rawXml, "text/xml") : null;
  const authorization = document
    ? xpath.select1("//*[local-name(.)='autorizacion'][1]", document)
    : null;
  const estado =
    response?.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion?.estado ||
    response?.estado ||
    (authorization ? text(authorization, "*[local-name(.)='estado']") : "");

  return {
    estado: String(estado || "").toUpperCase(),
    numeroAutorizacion: authorization ? text(authorization, "*[local-name(.)='numeroAutorizacion']") : "",
    fechaAutorizacion: authorization ? text(authorization, "*[local-name(.)='fechaAutorizacion']") : "",
    messages: authorization ? collectMessages(authorization) : collectMessagesFromObject(response),
    authorizationXml: authorization ? authorization.toString() : "",
    rawXml
  };
}

function collectMessagesFromObject(response) {
  const messages = [];

  function walk(value) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (value.identificador || value.mensaje || value.informacionAdicional || value.tipo) {
      messages.push({
        identificador: String(value.identificador || ""),
        mensaje: String(value.mensaje || ""),
        informacionAdicional: String(value.informacionAdicional || ""),
        tipo: String(value.tipo || "")
      });
    }

    Object.values(value).forEach(walk);
  }

  walk(response);
  return messages;
}

async function createSoapClient(wsdl, timeout) {
  return soap.createClientAsync(wsdl, {
    wsdl_options: { timeout },
    request: undefined
  });
}

async function sendDocument(company, signedXml, options = {}) {
  const timeout = options.timeout || 30000;
  const endpoints = sriEndpoints(company);
  const client = options.client || (await createSoapClient(endpoints.reception, timeout));
  const xmlBase64 = Buffer.from(signedXml, "utf8").toString("base64");

  if (typeof client.validarComprobanteAsync !== "function") {
    throw soapError("El cliente SOAP de recepcion SRI no expone validarComprobante");
  }

  const [result, rawResponse] = await client.validarComprobanteAsync({ xml: xmlBase64 });
  return parseReceptionResponse({ ...result, rawXml: rawResponse });
}

async function queryAuthorization(company, accessKey, options = {}) {
  const timeout = options.timeout || 30000;
  const endpoints = sriEndpoints(company);
  const client = options.client || (await createSoapClient(endpoints.authorization, timeout));

  if (typeof client.autorizacionComprobanteAsync !== "function") {
    throw soapError("El cliente SOAP de autorizacion SRI no expone autorizacionComprobante");
  }

  const [result, rawResponse] = await client.autorizacionComprobanteAsync({ claveAccesoComprobante: accessKey });
  return parseAuthorizationResponse({ ...result, rawXml: rawResponse });
}

module.exports = {
  ENDPOINTS,
  parseAuthorizationResponse,
  parseReceptionResponse,
  queryAuthorization,
  sendDocument,
  sriEndpoints
};
