// src/features/home/components/NoteModal.jsx
import { useEffect, useState } from "react";

export default function NoteModal({ open, initialValue = "", onClose, onSave }) {
  const [val, setVal] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setVal(initialValue || "");
      setBusy(false);
    }
  }, [open, initialValue]);

  if (!open) return null;
  return (
    <div className="hp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="hp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hp-note-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="hp-note-title" className="hp-modal-title">Add a note (optional)</h3>
        <p className="hp-modal-sub">Share inspo (colors, shape, reference, etc.).</p>

        <textarea
          className="hp-note-area"
          rows={5}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="e.g., French tips, pastel pink, short almond…"
          autoFocus
        />

        <div className="hp-modal-actions">
          <button className="hp-btn" type="button" onClick={onClose} disabled={busy}>Back</button>
          <button
            className="hp-btn primary"
            type="button"
            onClick={async () => {
              setBusy(true);
              try { await Promise.resolve(onSave?.(val)); }
              finally { setBusy(false); onClose?.(); }
            }}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}
