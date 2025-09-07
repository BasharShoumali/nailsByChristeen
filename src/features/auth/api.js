// src/features/common/api.js
import { api } from "../../shared/lib/apiClient";

function normalizeApiBase(v) {
  if (!v) return null;
  const trimmed = String(v).replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit", // CORS: server does not use cookies here
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function recoverPassword(payload) {
  // Try a relative proxy first, then direct server bases.
  const envBase = normalizeApiBase(import.meta?.env?.VITE_API_BASE);
  const API_BASES = envBase
    ? [envBase]
    : ["/api", "http://localhost:4000/api", "http://127.0.0.1:4000/api"];

  let lastErr;
  for (const base of API_BASES) {
    try {
      return await postJson(`${base}/auth/recover`, payload); // -> { ok:true, password:"..." }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Network error");
}

/** Login with username or phone + password (uses shared client) */
export async function login({ userNameOrPhone, password }) {
  const data = await api.post(`/login`, { userNameOrPhone, password });
  if (!data?.ok) throw new Error(data?.error || "Login failed");
  return data.user || {};
}
