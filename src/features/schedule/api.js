// src/features/schedule/api.js
import { api } from "../../shared/lib/apiClient";

const hdr = (userID) => {
  const h = {};
  const n = Number(userID);
  if (Number.isFinite(n)) h["x-user-id"] = String(n);
  return h;
};

export const scheduleApi = {
  // Times config
  getTimes: (id, userID) =>
    api.get(`/times?id=${encodeURIComponent(id)}`, { headers: hdr(userID) }),

  patchTimes: (id, body, userID) =>
    api.patch(`/times?id=${encodeURIComponent(id)}`, body, { headers: hdr(userID) }),

  refreshTimes: (id, userID) =>
    api.post(`/admin/times/refresh?id=${encodeURIComponent(id)}`, {}, { headers: hdr(userID) }),

  // Per-day admin flags (myEvents)
  getDayFlags: (dateISO, userID) =>
    api.get(`/my-events/${dateISO}`, { headers: hdr(userID) }),

  patchDayFlags: (dateISO, body, userID) =>
    api.patch(`/my-events/${dateISO}`, body, { headers: hdr(userID) }),
};
