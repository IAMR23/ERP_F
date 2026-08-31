import { getSession } from "../services/api";

export function restoreSession() {
  return getSession();
}

export function hasPermission(session, permission) {
  return Boolean(session?.user?.permissions?.includes(permission));
}
