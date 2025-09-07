// src/features/storage/utils.js
import { createPortal } from "react-dom";

export function fmtDate(s) {
  return s ? String(s).slice(0, 10) : "—";
}

// Insert ZERO-WIDTH SPACE every 4 chars so long digit strings wrap
export function softWrapBarcode(s) {
  return s ? String(s).replace(/(.{4})/g, "$1\u200B") : s;
}

export function ModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

// basic local auth reader (same shape you used elsewhere)
export function readLocalAuth() {
  if (typeof window === "undefined") return { userID: null, role: "user" };
  const coerce = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const u = obj.user ?? obj.account ?? obj.profile ?? obj.session ?? obj.data ?? obj;
    const id = Number(u.userID ?? u.id ?? u.uid);
    const role = String((u.role ?? "user")).trim().toLowerCase();
    return { userID: Number.isFinite(id) ? id : null, role };
  };
  const tryJSON = (k) => { try { const v = localStorage.getItem(k); return v ? coerce(JSON.parse(v)) : null; } catch { return null; } };
  return (
    tryJSON("loggedUser") ||
    tryJSON("user") ||
    tryJSON("auth") ||
    (() => {
      try {
        const id = Number(localStorage.getItem("userID"));
        const role = String((localStorage.getItem("role") || "user")).trim().toLowerCase();
        return { userID: Number.isFinite(id) ? id : null, role };
      } catch { return { userID: null, role: "user" }; }
    })()
  );
}
