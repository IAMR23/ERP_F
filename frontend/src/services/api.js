export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3100/api/v1";
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

function apiError(data, fallback = "Error de API") {
  const error = new Error(data.message || fallback);
  error.details = data.details || null;
  return error;
}

function networkErrorMessage(error) {
  if (error instanceof TypeError) {
    return `No se pudo conectar con la API en ${API_URL}. Verifica que el backend este activo, que use ese puerto y que CORS permita el origen del frontend.`;
  }

  return error.message || "No se pudo conectar con la API";
}

async function request(path, options = {}) {
  try {
    return await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    throw new Error(networkErrorMessage(error));
  }
}

export async function api(path, options = {}) {
  const session = getSession();
  const response = await request(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw apiError(data);
  }

  return data;
}

export async function apiForm(path, formData, options = {}) {
  const session = getSession();
  const response = await request(path, {
    ...options,
    body: formData,
    headers: {
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw apiError(data);
  }

  return data;
}

export function getSession() {
  const raw = window.localStorage.getItem("erp.session");
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(session) {
  window.localStorage.setItem("erp.session", JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem("erp.session");
}
