// src/features/account/api.js
function normalizeApiBase(v) {
  if (!v) return null;
  const t = String(v).replace(/\/+$/, "");
  return t.endsWith("/api") ? t : `${t}/api`;
}

const envBase = normalizeApiBase(import.meta?.env?.VITE_API_BASE);
const API_BASES = envBase ? [envBase] : ["/api", "http://localhost:4000/api", "http://127.0.0.1:4000/api"];

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function tryBases(path, payload) {
  let lastErr;
  for (const b of API_BASES) {
    try {
      return await postJson(`${b}${path}`, payload);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Network error");
}

// Update phone number API
export async function updatePhone({ userID, password, newPhone }) {
  return await tryBases("/account/update-phone", { userID, password, newPhone });
}

// Update password API
export async function updatePassword({ userID, currentPassword, newPassword }) {
  return await tryBases("/account/update-password", { userID, currentPassword, newPassword });
}
