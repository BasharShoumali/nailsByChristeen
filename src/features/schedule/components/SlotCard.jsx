// src/features/schedule/components/SlotCard.jsx
import React from "react";

export default function SlotCard({ label, time, open, disabled, isManager, onOnly, onToggle }) {
  return (
    <article className={`card ${open ? "" : "card--closed"} ${!isManager ? "is-readonly" : ""}`}>
      <div className="card__head">
        <div className="card__titles">
          <div className="card__label">{label} slot</div>
          <div className="card__time">{time}</div>
        </div>

        <label className="switch" title={!isManager ? "Managers only" : ""}>
          <input
            type="checkbox"
            checked={open}
            onChange={onToggle}
            disabled={disabled || !isManager}
            aria-label={`Toggle ${label} slot`}
          />
          <span className="switch__track"><span className="switch__thumb" /></span>
        </label>
      </div>

      <div className="card__actions">
        <button
          className="btn btn--accent"
          onClick={onOnly}
          disabled={disabled || !isManager}
          title={!isManager ? "Managers only" : "Only this"}
        >
          Only this
        </button>
        <button
          className="btn"
          onClick={onToggle}
          disabled={disabled || !isManager}
          title={!isManager ? "Managers only" : open ? "Close" : "Open"}
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      <div className="card__hint">
        {open
          ? "Users can book this time."
          : "Closed: users cannot book; an admin hold will occupy this slot."}
      </div>
    </article>
  );
}
