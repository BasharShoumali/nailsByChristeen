import { useMemo } from "react";
import { API } from "../lib/apiBase";
import { formatDate, formatDateTime } from "../lib/formatters";

export const SORTABLE_COLUMNS = {
  workDate: { label: "Date" },
  slot: { label: "Time" },
  status: { label: "Status" },
  updated_at: { label: "Last Updated" },
};

export default function OrdersTable({
  rows, loading, err,
  sortKey, sortDir, setSortKey, setSortDir,
  pendingCancel, requestCancel,
  openImgModal, refetch, setRows, setErr,
}) {
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "workDate" || sortKey === "updated_at") {
        const da = new Date(va).getTime(), db = new Date(vb).getTime();
        return da === db ? 0 : (da < db ? -1 : 1) * dir;
      }
      if (sortKey === "slot" || sortKey === "status") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // optimistic cancel here, but actual confirm is handled by parent
  async function cancelNow(id) {
    const prevRows = rows;
    try {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "canceled" } : r)));
      const res = await fetch(`${API}/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setRows(prevRows);
        setErr(data.error || "Failed to cancel appointment");
      } else {
        refetch?.();
      }
    } catch {
      setRows(prevRows);
      setErr("Network error. Could not cancel.");
    }
  }

  return (
    <>
      {err && <div className="orders-error">{err}</div>}
      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              {Object.entries(SORTABLE_COLUMNS).map(([key, { label }]) => (
                <th key={key} onClick={() => toggleSort(key)}>
                  <span className="th-label">
                    {label}
                    {sortKey === key && (
                      <span className="sort-caret">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </span>
                </th>
              ))}
              <th>Image</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`sk-${i}`} className="skeleton-row">
                  <td colSpan={6} />
                </tr>
              ))
            ) : sortedRows.length ? (
              sortedRows.map((r) => {
                const isPending = pendingCancel.has(r.id);
                return (
                  <tr key={r.id}>
                    <td>{formatDate(r.workDate)}</td>
                    <td>{r.slot}</td>
                    <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                    <td>{formatDateTime(r.updated_at)}</td>
                    <td>
                      {r.inspo_img ? (
                        <button className="btn-view" onClick={() => openImgModal(r.inspo_img)} title="View Inspiration Image">
                          View
                        </button>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {r.status === "open" ? (
                        <button
                          className="btn-cancel"
                          onClick={() => requestCancel(r.id, () => cancelNow(r.id))}
                          title="Cancel this appointment"
                          disabled={isPending}
                        >
                          {isPending ? "Canceling..." : "Cancel"}
                        </button>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="empty">No appointments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
