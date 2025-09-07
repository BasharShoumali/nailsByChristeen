// src/shared/lib/config.js
// Works in BOTH Vite (import.meta.env.VITE_*) and CRA (process.env.REACT_APP_*)

function readEnv(...keys) {
  // Vite
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      for (const k of keys) {
        if (import.meta.env[k] != null) return String(import.meta.env[k]);
      }
    }
  } catch {}
  // CRA / Node
  try {
    if (typeof process !== "undefined" && process.env) {
      for (const k of keys) {
        if (process.env[k] != null) return String(process.env[k]);
      }
    }
  } catch {}
  return undefined;
}

const rawBase  = readEnv("VITE_API_BASE", "REACT_APP_API_BASE");
const rawCreds = readEnv("VITE_API_CREDENTIALS", "REACT_APP_API_CREDENTIALS");

export const API_BASES = rawBase
  ? [rawBase]
  : ["/api", "http://localhost:4000/api", "http://127.0.0.1:4000/api"];

export const WITH_CREDENTIALS = String(rawCreds ?? "true").toLowerCase() === "true";
