import { api } from "../../shared/lib/apiClient";

export const adminApptsApi = {
  getSchedule: (dateStr) => api.get(`/admin/schedule2?date=${encodeURIComponent(dateStr)}`),
  getAvailability: (dateStr) => api.get(`/availability?date=${encodeURIComponent(dateStr)}`),
  patchAppointment: (id, body) => api.patch(`/appointments/${id}`, body),
};
