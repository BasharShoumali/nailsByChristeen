// src/features/storage/components/QuantityModal.jsx
import React, { useState } from "react";
import { ModalPortal } from "../utils";

export default function QuantityModal({ open, name, mode, onClose, onConfirm }) {
  const [qty, setQty] = useState(1);
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal__backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal__title">{mode === "add" ? "Add to Stock" : "Remove from Stock"}</h2>
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            const n = Number(qty);
            if (!Number.isInteger(n) || n <= 0) return;
            onConfirm?.(n);
          }}>
            <label>
              <span>{name}</span>
              <input type="number" min="1" step="1" value={qty} onChange={(e) => setQty(Number(e.target.value || 1))} required />
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn--accent">{mode === "add" ? "Add" : "Remove"}</button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
