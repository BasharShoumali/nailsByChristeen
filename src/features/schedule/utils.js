// src/features/schedule/utils.js

export function readLocalAuth() {
  if (typeof window === "undefined") return { userID: null, role: "user" };

  const coerce = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const u = obj.user ?? obj.account ?? obj.profile ?? obj.session ?? obj.data ?? obj;
    const id = Number(u.userID ?? u.id ?? u.uid);
    const role = String((u.role ?? "user")).trim().toLowerCase();
    return { userID: Number.isFinite(id) ? id : null, role: role || "user" };
  };

  const tryJSON = (key) => {
    try { const v = localStorage.getItem(key); return v ? coerce(JSON.parse(v)) : null; }
    catch { return null; }
  };

  return (
    tryJSON("loggedUser") ||
    tryJSON("user") ||
    tryJSON("auth") || (() => {
      try {
        const id = Number(localStorage.getItem("userID"));
        const role = String((localStorage.getItem("role") || "user")).trim().toLowerCase();
        return { userID: Number.isFinite(id) ? id : null, role };
      } catch { return { userID: null, role: "user" }; }
    })()
  );
}

export function readTimesId() {
  if (typeof window === "undefined") return 1;
  const n = Number(localStorage.getItem("timesId"));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftISO(dateISO, days) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
