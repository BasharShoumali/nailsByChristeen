import { api } from "../../shared/lib/apiClient";

/** GET /admin/users */
export async function getUsers() {
  return api.get(`/admin/users`);
}

/** GET /availability?date=YYYY-MM-DD */
export async function getAvailability(date) {
  return api.get(`/availability?date=${encodeURIComponent(date)}`);
}

/** POST /admin/users/:userId/appointments  { date, time } */
export async function createAppointmentForUser(userID, body) {
  return api.post(`/admin/users/${encodeURIComponent(userID)}/appointments`, body);
}

/** GET /my/appointments?userID=..&status=all */
export async function getUserHistory(userID) {
  return api.get(`/my/appointments?userID=${encodeURIComponent(userID)}&status=all`);
}

/** PATCH /appointments/:id  { status: "canceled" } */
export async function cancelAppointment(apptId) {
  return api.patch(`/appointments/${encodeURIComponent(apptId)}`, { status: "canceled" });
}
