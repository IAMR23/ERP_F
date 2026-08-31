import { api, apiForm } from "./api";

export function getCompanies() {
  return api("/organization/companies");
}

export function getCompanySettings(companyId) {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  return api(`/organization/company-settings${query}`);
}

export function createCompany(payload) {
  return api("/organization/companies", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateCompany(companyId, payload) {
  return api(`/organization/companies/${companyId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function updateCompanySettings(companyId, formData) {
  return apiForm(`/organization/companies/${companyId}/settings`, formData, {
    method: "PUT"
  });
}

export function getCompanyUsers() {
  return api("/organization/company-users");
}

export function createCompanyUser(payload) {
  return api("/organization/company-users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateCompanyUser(userId, payload) {
  return api(`/organization/company-users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function disableCompanyUser(userId) {
  return api(`/organization/company-users/${userId}`, {
    method: "DELETE"
  });
}

export function disableCompany(companyId) {
  return api(`/organization/companies/${companyId}`, {
    method: "DELETE"
  });
}

export function getBranches() {
  return api("/organization/branches");
}

export function createBranch(payload) {
  return api("/organization/branches", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateBranch(branchId, payload) {
  return api(`/organization/branches/${branchId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function disableBranch(branchId) {
  return api(`/organization/branches/${branchId}`, {
    method: "DELETE"
  });
}
