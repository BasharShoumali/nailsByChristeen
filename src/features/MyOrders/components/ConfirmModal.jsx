import { useEffect, useRef } from "react";

export default function ConfirmModal({
  open, title, message, confirmText = "Confirm", cancelText = "Cancel",
  onConfirm, onCancel, busy
}) {
  const dlgRef = useRef(null);

  useEffect(() => {
    if (open && dlgRef.current) {
      const btn = dlgRef.current.querySelector("button[data-primary]") || dlgRef.current.querySelector("button");
      btn?.focus();
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onClick={(e) => e.stopPropagation()}
        ref={dlgRef}
      >
        <h2 id="confirm-title" className="modal-title">{title}</h2>
        <p id="confirm-desc" className="modal-body">{message}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>{cancelText}</button>
          <button className="btn danger" data-primary onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
