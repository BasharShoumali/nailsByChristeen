import { api } from "../../shared/lib/apiClient";

export const reportsApi = {
  monthly: async (fromISO, toISO) => {
    const q = new URLSearchParams({ from: fromISO, to: toISO }).toString();
    return api.get(`/admin/reports/monthly?${q}`); // { ok, from, to, months:[{ym,year,month,appts,revenue}] }
  },
};
