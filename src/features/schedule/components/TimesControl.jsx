// src/features/schedule/components/TimesControl.jsx
import React, { useEffect, useMemo, useState } from "react";
import { scheduleApi } from "../api";

function labelEntries() {
  return [
    ["firstApp",  "First slot"],
    ["secondApp", "Second slot"],
    ["thirdApp",  "Third slot"],
    ["fourthApp", "Fourth slot"],
    ["fifthApp",  "Fifth slot"],
  ];
}

export default function TimesControl({ currentTimes, onTimesUpdated, userID, role, timesId }) {
  const isManager = role === "manager";
  const entries = useMemo(labelEntries, []);
  const [form, setForm] = useState(() => ({
    firstApp: currentTimes?.[0] || "10:30",
    secondApp: currentTimes?.[1] || "12:30",
    thirdApp:  currentTimes?.[2] || "15:00",
    fourthApp: currentTimes?.[3] || "17:00",
    fifthApp:  currentTimes?.[4] || "19:00",
  }));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [okMsg, setOkMsg]   = useState("");

  // reflect parent times changes
  useEffect(() => {
    if (!Array.isArray(currentTimes) || currentTimes.length !== 5) return;
    setForm({
      firstApp: currentTimes[0],
      secondApp: currentTimes[1],
      thirdApp:  currentTimes[2],
      fourthApp: currentTimes[3],
      fifthApp:  currentTimes[4],
    });
  }, [currentTimes]);

  // Load canonical values for this timesId
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await scheduleApi.getTimes(timesId, userID);
        const times = (data?.times || []).map((s) => String(s).slice(0, 5));
        if (!cancelled && times.length === 5) {
          setForm({
            firstApp: times[0],
            secondApp: times[1],
            thirdApp:  times[2],
            fourthApp: times[3],
            fifthApp:  times[4],
          });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Load times failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [timesId, userID]);

  const setField = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setError(""); setOkMsg(""); };

  const formTimes = [form.firstApp, form.secondApp, form.thirdApp, form.fourthApp, form.fifthApp];
  const hasEmpty  = formTimes.some((t) => !/^\d{2}:\d{2}$/.test(String(t || "")));
  const hasDupes  = new Set(formTimes).size !== formTimes.length;

  async function saveTimes(e) {
    e?.preventDefault?.();
    if (!isManager) return;
    if (hasEmpty) return setError("Please fill all 5 times (HH:MM).");
    if (hasDupes) return setError("Times must be distinct.");

    setSaving(true); setError(""); setOkMsg("");
    try {
      const norm = (s) => (String(s).length === 5 ? `${s}:00` : String(s));
      await scheduleApi.patchTimes(timesId, {
        firstApp:  norm(form.firstApp),
        secondApp: norm(form.secondApp),
        thirdApp:  norm(form.thirdApp),
        fourthApp: norm(form.fourthApp),
        fifthApp:  norm(form.fifthApp),
      }, userID);

      try { await scheduleApi.refreshTimes(timesId, userID); } catch {}

      const data = await scheduleApi.getTimes(timesId, userID);
      const times = (data?.times || []).map((s) => String(s).slice(0, 5));
      onTimesUpdated?.(times);
      setForm({
        firstApp: times[0], secondApp: times[1], thirdApp: times[2], fourthApp: times[3], fifthApp: times[4],
      });
      setOkMsg("Saved!");
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`card times-card ${!isManager ? "is-readonly" : ""}`}>
      <div className="times-card__head">
        <h2 className="card__title">Daily Appointment Times</h2>
        <div className="times-meta">Config ID: <strong>{timesId}</strong></div>
        <div className="btn-group">
          <button
            className="btn btn--accent btn--lg"
            onClick={saveTimes}
            disabled={saving || loading || !isManager}
            title={!isManager ? "Managers only" : "Save times"}
          >
            {saving ? "Saving…" : "Save times"}
          </button>
        </div>
      </div>

      {error && <div className="myevents__error" style={{ marginTop: 8 }}>{error}</div>}
      {!error && okMsg && <div className="ok-banner">{okMsg}</div>}
      {!isManager && <div className="warn-banner">Read-only — you are not a manager.</div>}

      <form className="times-grid" onSubmit={saveTimes}>
        {entries.map(([k, label]) => (
          <label className="times-item" key={k}>
            <span>{label}</span>
            <input
              type="time"
              step="60"
              value={form[k]}
              onChange={(e) => setField(k, e.target.value)}
              required
              disabled={!isManager}
            />
          </label>
        ))}
        <button type="submit" style={{ display: "none" }} aria-hidden />
      </form>

      <div className="times-hint">
        Make sure times are distinct and valid. Changes update the slots shown above immediately.
      </div>
    </section>
  );
}
