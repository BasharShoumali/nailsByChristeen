// src/features/storage/components/CategoryManager.jsx
import React, { useState } from "react";
import { storageApi } from "../api";
import { ModalPortal } from "../utils";

export default function CategoryManager({ open, onClose, categories, onChanged, userID, activeCategory, setActiveCategory }) {
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function addCategory(e) {
    e.preventDefault();
    const val = new FormData(e.currentTarget).get("category");
    const name = String(val || "").trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await storageApi.createCategory(name, userID);
      await onChanged?.();
      setActiveCategory?.(name);
      e.currentTarget.reset?.();
    } catch (err) {
      alert(err.message || "Add category failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCategory(name) {
    if (!window.confirm(`Delete category "${name}"? Items linked to it will block deletion.`)) return;
    setSubmitting(true);
    try {
      await storageApi.deleteCategory(name, userID);
      await onChanged?.();
      if (activeCategory === name) setActiveCategory?.("");
    } catch (err) {
      alert(err.message || "Delete category failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalPortal>
      <div className="modal__backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal__title">Manage Categories</h2>

          <form className="form" onSubmit={addCategory}>
            <label>
              <span>New Category Name *</span>
              <input name="category" required />
            </label>
            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>Close</button>
              <button type="submit" className="btn btn--accent" disabled={submitting}>Add</button>
            </div>
          </form>

          <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid var(--muted)" }} />
          <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Existing Categories</h3>

          {categories.length === 0 ? (
            <div className="center" style={{ padding: "8px 0" }}>No categories yet</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {categories.map((c) => (
                <li key={c}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                           border: "1px solid var(--muted)", borderRadius: 10, padding: "8px 10px", background: "var(--elev-1)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto" }} title={c}>
                    {c}
                  </span>
                  <button type="button" className="btn btn--danger" style={{ flex: "0 0 110px", textAlign: "center" }}
                          disabled={submitting} onClick={() => deleteCategory(c)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
