// src/shared/lib/apiClient.js
import { API_BASES, WITH_CREDENTIALS } from "./config";

let __apiBase = null;

/** Build a fetch init that avoids JSON Content-Type on GET/HEAD (reduces CORS preflights). */
function buildInit(method, body, init) {
  const headers = new Headers(init?.headers || {});
  // Only set Content-Type for methods that send a body
  if (!["GET", "HEAD"].includes(method) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const credentials = init?.credentials ?? (WITH_CREDENTIALS ? "include" : "same-origin");
  return {
    ...init,
    method,
    headers,
    credentials,
    body:
      body !== undefined
        ? (typeof body === "string" ? body : JSON.stringify(body))
        : init?.body,
  };
}

async function tryFetchJSON(base, path, init) {
  const url = `${base}${path}`;
  const res = await fetch(url, init);

  const ct = res.headers.get("content-type") || "";
  const text = await res.text(); // read once

  if (!res.ok) {
    const brief = text.slice(0, 200);
    throw new Error(`HTTP ${res.status}: ${brief || "(no body)"}`);
  }

  // 204 No Content or empty body -> return {}
  if (res.status === 204 || text.trim() === "") return {};

  // JSON if header says so OR body starts like JSON
  const looksJson = ct.includes("application/json") || /^[[{]/.test(text.trim());
  if (looksJson) {
    try {
      return JSON.parse(text);
    } catch {
      const brief = text.slice(0, 200);
      throw new Error(`Bad JSON from server. Body: ${brief}`);
    }
  }

  // Non-JSON successful response (rare in this app) -> return raw text
  return { raw: text };
}

async function request(path, init) {
  let lastErr;
  const bases = __apiBase
    ? [__apiBase, ...API_BASES.filter((b) => b !== __apiBase)]
    : API_BASES;

  for (const base of bases) {
    try {
      const data = await tryFetchJSON(base, path, init);
      __apiBase = base; // remember the working base
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Network error");
}

export const api = {
  get: (path, opts) =>
    request(path, buildInit("GET", undefined, opts)),
  post: (path, body, opts) =>
    request(path, buildInit("POST", body, opts)),
  patch: (path, body, opts) =>
    request(path, buildInit("PATCH", body, opts)),
  del: (path, opts) =>
    request(path, buildInit("DELETE", undefined, opts)),
};
