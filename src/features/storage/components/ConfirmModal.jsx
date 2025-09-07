// src/features/storage/components/ConfirmModal.jsx
import React from "react";
import { ModalPortal } from "../utils";

export default function ConfirmModal({ open, type, name, onClose, onConfirm }) {
  if (!open) return null;
  const isUse = type === "use";
  return (
    <ModalPortal>
      <div className="modal__backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal__title">{isUse ? "Confirm Use" : "Confirm Delete"}</h2>
          <div className="form" style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0 }}>
              {isUse ? (
                <>Use one unit of <strong>{name}</strong>? This will decrease the quantity by 1 and set <em>Last Used</em> to today.</>
              ) : (
                <>Delete <strong>{name}</strong>? This action cannot be undone.</>
              )}
            </p>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="button" className={`btn ${isUse ? "btn--accent" : "btn--danger"}`} onClick={onConfirm}>
                {isUse ? "Use one" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
