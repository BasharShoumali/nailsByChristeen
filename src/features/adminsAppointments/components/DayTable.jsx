import { useState } from "react";
import { fmtMoney } from "../utils";

function StatusBadge({ taken, isDone, status }) {
  const cls = taken ? (isDone ? "taken" : "open") : "open";
  return <span className={`aa-badge ${cls}`}>{taken ? status : "open"}</span>;
}

function ImageModal({ open, imgUrl, onClose }) {
  if (!open) return null;
  return (
    <div className="aa-modal-backdrop" onClick={onClose}>
      <div className="aa-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Inspiration Image</h3>
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Inspo"
            style={{
              maxWidth: "100%",
              maxHeight: 400,
              borderRadius: 8,
              marginTop: 10,
              marginBottom: 10,
            }}
          />
        ) : (
          <p>No image available</p>
        )}
        <div className="aa-modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* NEW: normalize paid amount from either column/key */
function getPaidAmount(appt) {
  if (!appt) return null;
  const candidates = [
    appt.paidAmount,
    appt.amountPaid,
    appt.paid_amount,
    appt.amount,
    appt.totalPaid,
    appt.total_amount,
    appt.price,
    appt.total,
    appt.paid,
  ];
  for (const v of candidates) {
    if (v !== null && v !== undefined) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

export default function DayTable({
  selectedDate,
  loading,
  err,
  slotOrder,
  bySlot,
  onOpenCloseModal,
  onCancel,
  dayTotal,
}) {
  const [imgOpen, setImgOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState("");

  function openImg(url) {
    setImgUrl(url);
    setImgOpen(true);
  }

  function closeImg() {
    setImgUrl("");
    setImgOpen(false);
  }

  return (
    <section className="aa-card">
      <div className="aa-card-head">
        <h2>
          Day status — <span className="aa-date">{selectedDate}</span>
        </h2>
        <span className="aa-pill">Total: {fmtMoney(dayTotal)}</span>
        {loading && <span className="aa-pill">Loading…</span>}
        {err && <span className="aa-pill err">{err}</span>}
      </div>

      <table className="aa-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Username</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Notes</th>
            <th>Image</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {slotOrder.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>
                {loading ? "Loading…" : "No slots configured"}
              </td>
            </tr>
          )}

          {slotOrder.map((t) => {
            const appt = bySlot[t];
            const taken = Boolean(appt);
            const status = appt?.status;

            // consider typical "finished" labels
            const isDone =
              status === "done" || status === "closed" || status === "paid";

            // Normalize image field
            const img =
              (appt &&
                (appt.inspo_img ??
                 appt.inspoImg ??
                 appt.image_url ??
                 appt.imageUrl ??
                 appt.inspoURL ??
                 null)) || null;

            // NEW: read amount from either column/key
            const paid = getPaidAmount(appt);

            return (
              <tr key={t}>
                <td>{t}</td>
                <td>{taken ? appt.userName : "-"}</td>
                <td>{taken ? appt.phoneNumber || "-" : "-"}</td>
                <td><StatusBadge taken={taken} isDone={isDone} status={status} /></td>

                {/* Notes column */}
                <td>{taken && appt?.notes ? appt.notes : "-"}</td>

                {/* Image column with View button */}
                <td>
                  {taken && img ? (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => openImg(img)}
                      title="View Inspiration Image"
                    >
                      View
                    </button>
                  ) : (
                    <span style={{ opacity: 0.6 }}>—</span>
                  )}
                </td>

                {/* Actions */}
                <td style={{ textAlign: "right" }}>
                  {taken ? (
                    <>
                      <button
                        className="btn ghost"
                        onClick={() => onOpenCloseModal(appt, t)}
                        disabled={isDone}
                      >
                        {isDone ? "Paid" : "Close"}
                      </button>
                      {isDone ? (
                        <button className="btn danger amount" disabled>
                          {`${fmtMoney(paid ?? 0)} 🤑`}
                        </button>
                      ) : (
                        <button
                          className="btn danger"
                          onClick={() => onCancel(appt, t)}
                          disabled={isDone}
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ opacity: 0.6 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal for viewing inspiration image */}
      <ImageModal open={imgOpen} imgUrl={imgUrl} onClose={closeImg} />
    </section>
  );
}
