import React from "react";

export default function RangeToolbar({ from, to, onFrom, onTo, loading, err, warn }) {
  return (
    <div className="rep-toolbar glass">
      <div className="rep-title">
        <h1>Monthly Reports</h1>
        <p className="muted">Last 12 months overview (includes current month)</p>
      </div>

      <div className="rep-controls">
        <label className="rep-field">
          <span>From</span>
          <input type="month" value={from.slice(0, 7)} onChange={(e) => onFrom(`${e.target.value}-01`)} />
        </label>
        <label className="rep-field">
          <span>To</span>
          <input type="month" value={to.slice(0, 7)} onChange={(e) => onTo(`${e.target.value}-01`)} />
        </label>
        {loading && <span className="pill">Loading…</span>}
        {err && <span className="pill error">{err}</span>}
        {warn && !err && <span className="pill warn">{warn}</span>}
      </div>
    </div>
  );
}
