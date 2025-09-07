// src/features/schedule/pages/SchedulePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../../../cssFiles/Schedule.css";
import SlotCard from "../components/SlotCard";
import TimesControl from "../components/TimesControl";
import { scheduleApi } from "../api";
import { readLocalAuth, readTimesId, todayISO, shiftISO } from "../utils";

export default function SchedulePage() {
  const { userID, role } = useMemo(readLocalAuth, []);
  const isManager = role === "manager";
  const timesId = useMemo(readTimesId, []);

  const [date, setDate] = useState(todayISO());
  const [flags, setFlags] = useState({
    firstApp: true, secondApp: true, thirdApp: true, fourthApp: true, fifthApp: true,
  });
  const [times, setTimes] = useState(["10:30", "12:30", "15:00", "17:00", "19:00"]);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const items = useMemo(() => ([
    { key: "firstApp",  label: "First",  time: times[0] || "—" },
    { key: "secondApp", label: "Second", time: times[1] || "—" },
    { key: "thirdApp",  label: "Third",  time: times[2] || "—" },
    { key: "fourthApp", label: "Fourth", time: times[3] || "—" },
    { key: "fifthApp",  label: "Fifth",  time: times[4] || "—" },
  ]), [times]);

  async function loadAll(selDate) {
    setLoading(true); setError("");
    try {
      const [tres, eres] = await Promise.all([
        scheduleApi.getTimes(timesId, userID),
        scheduleApi.getDayFlags(selDate, userID),
      ]);

      if (Array.isArray(tres?.times) && tres.times.length === 5) {
        setTimes(tres.times.map((s) => String(s).slice(0, 5)));
      }

      const e = eres?.event || {};
      setFlags({
        firstApp: !!e.firstApp, secondApp: !!e.secondApp, thirdApp: !!e.thirdApp,
        fourthApp: !!e.fourthApp, fifthApp: !!e.fifthApp,
      });
    } catch (e) {
      setError(e.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(date); /* initial+date changes */ }, [date]); // eslint-disable-line

  async function save(next) {
    if (!isManager) return;
    setSaving(true); setError("");
    try {
      await scheduleApi.patchDayFlags(date, next, userID);
      await loadAll(date);
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const enableAll = () => save({ firstApp: true, secondApp: true, thirdApp: true, fourthApp: true, fifthApp: true });
  const disableAll = () => save({ firstApp: false, secondApp: false, thirdApp: false, fourthApp: false, fifthApp: false });
  const onlyThis  = (k) => save({ only: k });
  const toggle    = (k) => save({ ...flags, [k]: !flags[k] });

  return (
    <div className="myevents">
      <header className="myevents__header">
        <h1 className="myevents__title">My Events — Open/Close Slots</h1>

        <div className="myevents__toolbar">
          <div className="datepicker">
            <button className="btn" onClick={() => setDate(shiftISO(date, -1))} aria-label="Previous day">◀</button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Select date" />
            <button className="btn" onClick={() => setDate(shiftISO(date, +1))} aria-label="Next day">▶</button>
          </div>

          <div className="toolbar__spacer" />

          <div className="btn-group">
            <button className="btn btn--accent btn--lg" onClick={enableAll} disabled={saving || !isManager}
              title={!isManager ? "Managers only" : "Enable all"}>
              Enable all
            </button>
            <button className="btn btn--danger btn--lg" onClick={disableAll} disabled={saving || !isManager}
              title={!isManager ? "Managers only" : "Disable all"}>
              Disable all
            </button>
          </div>
        </div>
      </header>

      {!isManager && <div className="warn-banner" style={{ marginBottom: 8 }}>Read-only — you are not a manager.</div>}
      {error && <div className="myevents__error">{error}</div>}

      <section className="cards">
        {items.map(({ key, label, time }) => (
          <SlotCard
            key={key}
            label={label}
            time={time}
            open={!!flags[key]}
            isManager={isManager}
            disabled={saving || loading}
            onOnly={() => onlyThis(key)}
            onToggle={() => toggle(key)}
          />
        ))}
      </section>

      {loading && <div className="center" style={{ marginTop: 12 }}>Loading…</div>}
      {saving && !loading && <div className="center" style={{ marginTop: 12 }}>Saving…</div>}

      <footer className="myevents__foot">
        <small>Changes apply only to <strong>{date}</strong>.</small>
      </footer>

      <TimesControl
        currentTimes={times}
        onTimesUpdated={(t) => setTimes(Array.isArray(t) && t.length === 5 ? t.map((s) => String(s).slice(0, 5)) : times)}
        userID={userID}
        role={role}
        timesId={timesId}
      />
    </div>
  );
}
