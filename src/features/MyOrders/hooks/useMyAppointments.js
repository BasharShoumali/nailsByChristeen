import { useCallback, useEffect, useState } from "react";
import { API } from "../lib/apiBase";

export default function useMyAppointments(userID, statusFilter) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchData = useCallback(async (signal) => {
    if (!userID) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch(
        `${API}/api/my/appointments?userID=${encodeURIComponent(userID)}&status=${encodeURIComponent(statusFilter)}`,
        { signal }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(data.error || "Failed to load appointments");
        setRows([]);
      } else {
        setRows(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        setErr("Network error loading appointments");
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [userID, statusFilter]);

  useEffect(() => {
    if (!userID) return;
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [userID, statusFilter, fetchData]);

  return { rows, setRows, loading, err, setErr, refetch: () => fetchData() };
}
