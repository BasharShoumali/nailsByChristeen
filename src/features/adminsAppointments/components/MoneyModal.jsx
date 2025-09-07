import { useEffect, useState } from "react";
import { CURRENCY, toAmount } from "../utils";

export default function MoneyModal({ open, onClose, onSubmit, appt, slotLabel, defaultValue, date }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(defaultValue ?? "");
      setErr("");
      setSubmitting(false);
    }
  }, [open, defaultValue]);

  function submit() {
    const amt = toAmount(value);
    if (isNaN(amt)) {
      setErr("Enter a valid non-negative number");
      return;
    }
    setSubmitting(true);
    Promise.resolve(onSubmit(amt)).catch((e) => {
      setErr(e?.message || "Failed to save");
      setSubmitting(false);
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") submit();
  }

  if (!open) return null;
  return (
    <div className="aa-modal-backdrop" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1} role="presentation">
      <div className="aa-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 id="aa-modal-title">Close & record payment</h3>
        <p className="aa-modal-sub">
          {appt?.userName ? <strong>{appt.userName}</strong> : "User"} — {date} • {slotLabel}
        </p>

        <label className="aa-field">
          <span>Amount ({CURRENCY})</span>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>

        {err && <div className="aa-form-err">{err}</div>}

        <div className="aa-modal-actions">
          <button className="btn" type="button" onClick={onClose} disabled={submitting}>Back</button>
          <button className="btn ghost" type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : "Save & Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
