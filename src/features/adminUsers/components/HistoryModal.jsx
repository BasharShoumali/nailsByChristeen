import { useEffect, useMemo, useState } from "react";
import { getUserHistory, cancelAppointment } from "../api";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmtDT   = (d) => (d ? new Date(d).toLocaleString() : "—");
const statusRank = (s) => (s === "open" ? 0 : s === "closed" ? 1 : 2);

export default function HistoryModal({ open, user, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [cancelingId, setCancelingId] = useState(null);

  // load on open
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setErr(""); setRows([]);
        const r = await getUserHistory(user.userID);
        if (!r.ok) throw new Error(r.error || "Failed to load history");
        if (!cancelled) setRows(r.appointments || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const ra = statusRank(a.status); const rb = statusRank(b.status);
      if (ra !== rb) return ra - rb;
      const da = String(a.workDate || ""); const db = String(b.workDate || "");
      if (da !== db) return da.localeCompare(db);
      const ta = (a.slot || "").slice(0, 5); const tb = (b.slot || "").slice(0, 5);
      return ta.localeCompare(tb);
    });
    return copy;
  }, [rows]);

  async function doCancel(id) {
    try {
      setErr(""); setCancelingId(id);
      const r = await cancelAppointment(id);
      if (!r.ok) throw new Error(r.error || "Failed to cancel appointment");
      setRows((prev) =>
        prev.map((it) => it.id === id ? { ...it, status: "canceled", updated_at: new Date().toISOString() } : it)
      );
    } catch (e) {
      setErr(e.message || "Cancel failed");
    } finally {
      setCancelingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="au-modal-backdrop" onMouseDown={onClose}>
      <div
        className="au-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="au-hist-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="au-modal-head">
          <div className="au-modal-icon">🕓</div>
          <div className="au-modal-titles">
            <h3 id="au-hist-title">Appointment history</h3>
            {user && (
              <p className="au-modal-sub">
                For <strong>{[user.firstName || "", user.lastName || ""].join(" ").trim() || "—"}</strong>{" "}
                <span className="au-username">(@{user.userName || user.userID})</span>
              </p>
            )}
          </div>
          <button className="au-icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div className="au-modal-divider" />
        <div className="au-modal-body">
          {loading && <div className="au-pill">Loading…</div>}
          {err && <div className="au-form-err">{err}</div>}

          {!loading && !err && (
            <div className="au-table-wrap">
              <table className="au-table au-table-compact">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th className="au-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length > 0 ? (
                    sorted.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Date">{fmtDate(r.workDate)}</td>
                        <td className="au-num" data-label="Time">{(r.slot || "").slice(0, 5)}</td>
                        <td data-label="Status"><span className={`au-badge au-${r.status}`}>{r.status}</span></td>
                        <td data-label="Created">{fmtDT(r.created_at)}</td>
                        <td data-label="Updated">{fmtDT(r.updated_at)}</td>
                        <td className="au-actions-cell" data-label="Actions">
                          {r.status === "open" ? (
                            <button
                              className="au-btn au-secondary"
                              onClick={() => doCancel(r.id)}
                              disabled={cancelingId === r.id}
                              aria-label="Cancel appointment"
                            >
                              {cancelingId === r.id ? "Canceling…" : "Cancel"}
                            </button>
                          ) : (
                            <span className="au-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="au-muted au-center">No history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="au-modal-actions">
          <button type="button" className="au-btn" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}
