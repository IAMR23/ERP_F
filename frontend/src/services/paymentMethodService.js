import { api } from "./api";

export function getPaymentMethods() {
  return api("/payment-methods");
}

export function createPaymentMethod(payload) {
  return api("/payment-methods", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePaymentMethod(id, payload) {
  return api(`/payment-methods/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deletePaymentMethod(id) {
  return api(`/payment-methods/${id}`, {
    method: "DELETE"
  });
}
