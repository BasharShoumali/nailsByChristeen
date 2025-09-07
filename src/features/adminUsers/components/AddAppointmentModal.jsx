import { useEffect, useMemo, useState } from "react";
import { getAvailability, createAppointmentForUser } from "../api";

const statusMsg = (count) =>
  `${count} slot${count === 1 ? "" : "s"} available`;

export default function AddAppointmentModal({ open, user, onClose, onCreated }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [avail, setAvail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const canSubmit = !!(open && user && date && time && !loading);

  // reset on open/user change
  useEffect(() => {
    if (!open) return;
    setDate("");
    setTime("");
    setAvail([]);
    setErr("");
    setOk("");
  }, [open, user]);

  // availability when date changes
  useEffect(() => {
    if (!open || !date) { setAvail([]); setErr(""); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setErr("");
        const r = await getAvailability(date);
        if (cancelled) return;
        if (!r.ok) throw new Error(r.error || "Failed to load availability");
        const slots = Array.isArray(r.available) ? r.available : [];
        setAvail(slots);
        setTime((prev) => (slots.length && !slots.includes(prev) ? slots[0] : prev));
      } catch (e) {
        if (!cancelled) { setAvail([]); setErr(e.message || "Could not load availability."); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, date]);

  const timeOpts = useMemo(() => (date ? avail : []), [date, avail]);

  async function submit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;
    try {
      setLoading(true); setErr(""); setOk("");
      const r = await createAppointmentForUser(user.userID, { date, time });
      if (!r.ok) throw new Error(r.error || "Failed to create appointment");
      setOk("Appointment created.");
      onCreated?.();
      setTimeout(() => onClose?.(), 500);
    } catch (e) {
      const msg = String(e.message || "");
      if (msg.includes("409") || /already booked/i.test(msg)) {
        setErr("That time is already booked. Pick a different one.");
      } else {
        setErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="au-modal-backdrop" onMouseDown={onClose}>
      <div
        className="au-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="au-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="au-modal-head">
          <div className="au-modal-icon">+</div>
          <div className="au-modal-titles">
            <h3 id="au-modal-title">Add appointment</h3>
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
          <form onSubmit={submit} className="au-form au-form-grid">
            <label className="au-field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            <label className="au-field">
              <span>
                Time{" "}
                {date && !loading && <small className="au-muted">— {statusMsg(timeOpts.length)}</small>}
              </span>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!date || loading || timeOpts.length === 0}
                required
              >
                {!date && <option value="" disabled>Pick a date first</option>}
                {date && loading && <option value="" disabled>Loading times…</option>}
                {date && !loading && timeOpts.length === 0 && (
                  <option value="" disabled>No slots available</option>
                )}
                {date && !loading && timeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {err && <small className="au-muted">{err}</small>}
            </label>

            {ok && <div className="au-form-ok">{ok}</div>}
          </form>
        </div>

        <footer className="au-modal-actions">
          <button type="button" className="au-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="button" className="au-btn au-primary" onClick={submit} disabled={!canSubmit}>
            {loading ? "Saving…" : "Create"}
          </button>
        </footer>
      </div>
    </div>
  );
}
