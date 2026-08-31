import { api } from "./api";

export function getPeople(search = "") {
  const params = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return api(`/people${params}`);
}

export function getPerson(id) {
  return api(`/people/${id}`);
}

export function createPerson(payload) {
  return api("/people", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePerson(id, payload) {
  return api(`/people/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function setPersonActive(id, activo) {
  return api(`/people/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ activo })
  });
}
