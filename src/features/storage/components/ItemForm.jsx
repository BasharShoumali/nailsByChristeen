// src/features/storage/components/ItemForm.jsx
import React, { useEffect, useState } from "react";
import { storageApi } from "../api";
import { ModalPortal } from "../utils";

export default function ItemForm({
  open,
  editing,
  onClose,
  onSaved,
  categories = [],
  userID,
}) {
  // Hooks must be unconditional
  const isEdit = !!editing;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productName: editing?.productName || "",
    categoryName: editing?.categoryName || "",
    barcode: editing?.barcode || "",
    color: editing?.color || "",
    firma: editing?.firma || "",
    qnt: editing?.qnt ?? 0, // used only on create
  });

  // Reset form whenever dialog opens or editing target changes
  useEffect(() => {
    if (!open) return;
    setForm({
      productName: editing?.productName || "",
      categoryName: editing?.categoryName || "",
      barcode: editing?.barcode || "",
      color: editing?.color || "",
      firma: editing?.firma || "",
      qnt: editing?.qnt ?? 0,
    });
  }, [open, editing]);

  // ESC to close (active only when open)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus first control when opened
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(".modal input, .modal select");
      el?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, editing]);

  const bind = (k) => ({
    value: form[k] ?? "",
    onChange: (e) =>
      setForm((f) => ({
        ...f,
        [k]: k === "qnt" ? Number(e.target.value || 0) : e.target.value,
      })),
  });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        const oldName = editing.productName;
        const body = {
          productName: form.productName,
          categoryName: form.categoryName,
          barcode: form.barcode || null,
          color: form.color || null,
          firma: form.firma || null,
        };
        await storageApi.updateProduct(oldName, body, userID);
      } else {
        const body = {
          productName: form.productName,
          categoryName: form.categoryName,
          barcode: form.barcode || null,
          color: form.color || null,
          firma: form.firma || null,
          qnt: Number(form.qnt || 0),
        };
        await storageApi.createProduct(body, userID);
      }
      await onSaved?.();
    } catch (e2) {
      alert(e2.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Only render after hooks are declared
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal__backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="modal__title">{isEdit ? "Edit Item" : "Add Item"}</h2>
          <form className="form" onSubmit={submit}>
            <div className="form__grid">
              <label>
                <span>Product Name *</span>
                <input required {...bind("productName")} />
              </label>
              <label>
                <span>Category *</span>
                <select required {...bind("categoryName")}>
                  <option value="" disabled>Choose…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label><span>Barcode</span><input {...bind("barcode")} /></label>
              <label><span>Color</span><input {...bind("color")} /></label>
              <label><span>Brand</span><input {...bind("firma")} /></label>
              {!isEdit && (
                <label>
                  <span>Initial Quantity</span>
                  <input type="number" min="0" step="1" {...bind("qnt")} />
                </label>
              )}
            </div>

            <div className="modal__actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn--accent" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
