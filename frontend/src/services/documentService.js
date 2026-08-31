import { api } from "./api";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getDocuments(params) {
  return api(`/documents${buildQuery(params)}`);
}

export function getDocument(id) {
  return api(`/documents/${id}`);
}

export function validateCreditNoteInvoice(payload) {
  return api("/documents/credit-notes/validate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function validateSriDocument(id) {
  return api(`/documents/${id}/sri/validate`, {
    method: "POST"
  });
}

export function sendSriDocument(id) {
  return api(`/documents/${id}/sri/send`, {
    method: "POST"
  });
}

export function createDocument(payload) {
  return api("/documents", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
