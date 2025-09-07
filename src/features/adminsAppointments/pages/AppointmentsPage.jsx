import { useEffect, useMemo, useRef, useState } from "react";
import "../../../cssFiles/Appointments.css";
import { adminApptsApi } from "../api";
import { formatISOLocal, toAmount, toMinutes } from "../utils";
import DayBar from "../components/DayBar";
import DayTable from "../components/DayTable";
import MoneyModal from "../components/MoneyModal";

/* ---------- Generic confirm modal (uses your aa-modal styles) ---------- */
function ConfirmModal({ open, title, message, confirmText = "Confirm", cancelText = "Cancel", busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="aa-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="aa-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" style={{ marginBottom: 6 }}>{title}</h3>
        <p id="confirm-desc" className="aa-modal-sub">{message}</p>
        <div className="aa-modal-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>{cancelText}</button>
          <button className="btn danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState(formatISOLocal(new Date()));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Chronological list of all day slots (taken + free)
  const [slotOrder, setSlotOrder] = useState([]);

  // slot → { id, userName, phoneNumber, status("open"|"done"), notes, paidAmount? }
  const [bySlot, setBySlot] = useState({});
  const latestReq = useRef(selectedDate);

  // Money modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAppt, setModalAppt] = useState(null);
  const [modalSlot, setModalSlot] = useState(null);

  // Confirm-cancel modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { appt, slotLabel }
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function loadSchedule(dateStr) {
    setLoading(true);
    setErr("");
    latestReq.current = dateStr;
    try {
      const [sched, avail] = await Promise.all([
        adminApptsApi.getSchedule(dateStr),     // { ok, schedule:[{slot,...}], totalPaid }
        adminApptsApi.getAvailability(dateStr), // { ok, available:["HH:MM", ...] }
      ]);
      if (!sched.ok) throw new Error(sched.error || "Failed to load schedule");
      if (!avail.ok) throw new Error(avail.error || "Failed to load availability");
      if (latestReq.current !== dateStr) return;

      const map = {};
      for (const row of sched.schedule || []) {
        map[row.slot] = {
          ...row,
          paidAmount:
            typeof row.paidAmount === "number"
              ? row.paidAmount
              : typeof row.amountPaid === "number"
              ? row.amountPaid
              : undefined,
        };
      }

      const union = new Set([
        ...Object.keys(map),
        ...((avail.available || []).map((s) => String(s).slice(0, 5))),
      ]);
      const fullOrder = Array.from(union).sort((a, b) => toMinutes(a) - toMinutes(b));

      setBySlot(map);
      setSlotOrder(fullOrder);
    } catch (e) {
      if (latestReq.current !== dateStr) return;
      setErr(e.message || "Error");
      setBySlot({});
      setSlotOrder([]);
    } finally {
      if (latestReq.current === dateStr) setLoading(false);
    }
  }

  useEffect(() => { loadSchedule(selectedDate); }, [selectedDate]);

  const dayTotal = useMemo(() => {
    let sum = 0;
    for (const t of slotOrder) {
      const r = bySlot[t];
      if (r && r.status === "done") {
        const a = toAmount(r.paidAmount);
        if (!isNaN(a)) sum += a;
      }
    }
    return sum;
  }, [bySlot, slotOrder]);

  async function patchAppointment(id, body) {
    const data = await adminApptsApi.patchAppointment(id, body);
    if (!data.ok) throw new Error(data?.error || "Update failed");
  }

  // Money modal helpers
  function openCloseModal(appt, slotLabel) {
    setModalAppt(appt);
    setModalSlot(slotLabel);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setModalAppt(null);
    setModalSlot(null);
  }

  async function submitClose(amount) {
    const appt = modalAppt;
    const slotLabel = modalSlot;
    if (!appt || !slotLabel) return;

    // optimistic update
    setBySlot((prev) => {
      const copy = { ...prev };
      if (copy[slotLabel]) copy[slotLabel] = { ...copy[slotLabel], status: "done", paidAmount: amount };
      return copy;
    });

    try {
      await patchAppointment(appt.id, { status: "closed", paidAmount: amount });
      closeModal();
      loadSchedule(selectedDate);
    } catch (e) {
      // revert optimistic (MoneyModal will show inline error via reject)
      setBySlot((prev) => {
        const copy = { ...prev };
        if (copy[slotLabel]) copy[slotLabel] = { ...copy[slotLabel], status: appt.status, paidAmount: appt.paidAmount };
        return copy;
      });
      throw e; // MoneyModal catches and shows aa-form-err (no alert)
    }
  }

  /* ---------- Cancel flow: open confirm modal instead of window.confirm ---------- */
  function requestCancel(appt, slotLabel) {
    if (!appt || appt.status === "done") return; // cannot cancel when closed
    setConfirmTarget({ appt, slotLabel });
    setConfirmOpen(true);
  }

  async function confirmCancel() {
    if (!confirmTarget) return;
    const { appt, slotLabel } = confirmTarget;
    setConfirmBusy(true);
    try {
      await patchAppointment(appt.id, { status: "canceled" });
      setConfirmOpen(false);
      setConfirmTarget(null);
      loadSchedule(selectedDate);
    } catch (e) {
      // Show the error in the page (badge at top) instead of alert
      setErr(e.message || "Update failed");
      setConfirmOpen(false);
      setConfirmTarget(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  function cancelConfirmModal() {
    setConfirmOpen(false);
    setConfirmTarget(null);
  }

  return (
    <div className="admin-appts">
      <header className="aa-header">
        <h1>Appointments</h1>
        <div className="aa-datepick">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
      </header>

      <DayBar selectedDate={selectedDate} onSelect={setSelectedDate} loading={loading} />

      <DayTable
        selectedDate={selectedDate}
        loading={loading}
        err={err}
        slotOrder={slotOrder}
        bySlot={bySlot}
        onOpenCloseModal={openCloseModal}
        onCancel={requestCancel}     // <-- uses popup, not window.confirm
        dayTotal={dayTotal}
      />

      <MoneyModal
        open={modalOpen}
        onClose={closeModal}
        onSubmit={submitClose}
        appt={modalAppt}
        slotLabel={modalSlot}
        date={selectedDate}
        defaultValue={modalAppt?.paidAmount ?? ""}
      />

      {/* Confirm Cancel Modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Cancel appointment?"
        message={
          confirmTarget
            ? `${confirmTarget.appt?.userName || "User"} — ${selectedDate} • ${confirmTarget.slotLabel}`
            : ""
        }
        confirmText="Yes, cancel"
        cancelText="Keep appointment"
        busy={confirmBusy}
        onConfirm={confirmCancel}
        onCancel={cancelConfirmModal}
      />
    </div>
  );
}
