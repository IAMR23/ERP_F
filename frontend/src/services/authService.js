import { api, clearSession, saveSession } from "./api";

export async function login(email, password) {
  const session = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });

  saveSession(session);
  return session;
}

export function logout() {
  clearSession();
}
