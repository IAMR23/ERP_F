import { API_URL, api, getSession } from "./api";

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

export function consultSriAuthorization(id) {
  return api(`/documents/${id}/sri/authorization`, {
    method: "POST"
  });
}

export function sendInvoiceEmail(id, force = false) {
  return api(`/documents/${id}/email`, {
    method: "POST",
    body: JSON.stringify({ force })
  });
}

export function updateDocumentWarehouse(id, warehouseId) {
  return api(`/documents/${id}/warehouse`, {
    method: "PATCH",
    body: JSON.stringify({ warehouseId })
  });
}

export async function downloadRidePdf(id) {
  const session = getSession();
  const response = await fetch(`${API_URL}/documents/${id}/ride`, {
    headers: {
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {})
    }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "No se pudo descargar el RIDE PDF");
  }

  const disposition = response.headers.get("Content-Disposition") || "";
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || "RIDE.pdf";
  return { blob: await response.blob(), fileName };
}

export function createDocument(payload) {
  return api("/documents", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
