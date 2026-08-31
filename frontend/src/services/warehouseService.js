import { api } from "./api";

export function getWarehouseOptions() {
  return api("/warehouses/options");
}

export function getWarehouses() {
  return api("/warehouses");
}

export function createWarehouse(payload) {
  return api("/warehouses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createStockEntry(warehouseId, payload) {
  return api(`/warehouses/${warehouseId}/stock-entries`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createStockTransfer(sourceWarehouseId, payload) {
  return api(`/warehouses/${sourceWarehouseId}/transfers`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
