// src/features/home/HomePage.jsx
import { useMemo, useState, useEffect } from "react";
import DateBar from "./components/DateBar";
import TimeSlots from "./components/TimeSlots";
import NoteModal from "./components/NoteModal";
import ImageModal from "./components/ImageModal";
import { isoDate, addDays } from "./lib/date";
import { API } from "./lib/apiBase";
import "./HomePage.css";

const LOCATION = "Nails by Christeen, Shefara'am, Israel";
const FALLBACK_TIMES = ["10:30", "12:30", "15:00", "17:00", "19:00"];

export default function HomePage() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const next10Iso = useMemo(
    () => Array.from({ length: 10 }, (_, i) => isoDate(addDays(today, i))),
    [today]
  );

  const [selectedDate, setSelectedDate] = useState(next10Iso[0]);

  // dynamic time config
  const [allTimes, setAllTimes] = useState(FALLBACK_TIMES);
  const [loadingTimesConfig, setLoadingTimesConfig] = useState(true);

  // availability
  const [available, setAvailable] = useState([]);
  const [taken, setTaken] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const [selectedTime, setSelectedTime] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState("");

  // note + image
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [inspoImg, setInspoImg] = useState("");
  const [imgOpen, setImgOpen] = useState(false);

  const minPicker = isoDate(today);

  const loggedUser = (() => {
    try { return JSON.parse(localStorage.getItem("loggedUser") || "null"); }
    catch { return null; }
  })();

  // 1) load configured times
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingTimesConfig(true);
      setErr("");
      try {
        const res = await fetch(`${API}/api/times`);
        if (!res.ok) throw new Error("no /api/times");
        const data = await res.json().catch(() => ({}));
        if (alive && data?.ok && Array.isArray(data.times) && data.times.length) {
          setAllTimes(data.times.map((s) => String(s).slice(0, 5)));
        } else if (alive) {
          setAllTimes(FALLBACK_TIMES);
        }
      } catch {
        if (alive) setAllTimes(FALLBACK_TIMES);
      } finally {
        if (alive) setLoadingTimesConfig(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 2) availability per date
  useEffect(() => {
    let alive = true;
    if (!selectedDate) return;
    (async () => {
      setErr("");
      setConfirmed(false);
      setSelectedTime(null);
      setNote("");
      setInspoImg("");
      setLoadingAvail(true);
      try {
        const res = await fetch(`${API}/api/availability?date=${selectedDate}`);
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !data.ok) {
          setErr(data.error || "Failed loading availability");
          setAvailable([]); setTaken([]);
        } else {
          const avail = Array.isArray(data.available)
            ? data.available.map((s) => String(s).slice(0, 5))
            : [];
          setAvailable(avail);
          setTaken(allTimes.filter((t) => !avail.includes(t)));
        }
      } catch {
        if (alive) {
          setErr("Network error loading availability");
          setAvailable([]); setTaken([]);
        }
      } finally {
        if (alive) setLoadingAvail(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedDate, allTimes]);

  // 3) confirm
  async function handleConfirm() {
    setErr("");
    if (!loggedUser?.userID) {
      setErr("Please log in to place an appointment.");
      return;
    }
    if (!selectedDate || !selectedTime) return;

    try {
      const res = await fetch(`${API}/api/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userID: loggedUser.userID,
          date: selectedDate,
          time: selectedTime,
          location: LOCATION,
          notes: note?.trim() || undefined,
          inspo_img: inspoImg?.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not create appointment.");
        return;
      }
      setConfirmed(true);
      setAvailable((prev) => prev.filter((t) => t !== selectedTime));
      setTaken((prev) => (prev.includes(selectedTime) ? prev : [...prev, selectedTime]));
      window.dispatchEvent(new CustomEvent("appt:created", { detail: { date: selectedDate, time: selectedTime } }));
    } catch {
      setErr("Network error. Please try again.");
    }
  }

  const prettyDate = new Date(selectedDate).toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="home-container">
      <h1 className="page-title">Book Your Appointment</h1>

      {err && <div className="auth-error" style={{ marginBottom: 12 }}>{err}</div>}

      <DateBar datesIso={next10Iso} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div className="date-picker-wrap">
        <label htmlFor="dp" className="dp-label">Pick another date:</label>
        <input id="dp" className="date-picker" type="date" value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)} min={minPicker} />
      </div>

      <TimeSlots
        dateIso={selectedDate}
        times={allTimes}
        taken={taken}
        selectedTime={selectedTime}
        onSelectTime={(t) => { setSelectedTime(t); setConfirmed(false); }}
        loading={loadingTimesConfig || loadingAvail}
      />

      {selectedDate && selectedTime && !confirmed && (
        <>
          <p className="summary-text">
            Appointment on <strong>{prettyDate}</strong> at <strong>{selectedTime}</strong>
            <br /> Location: {LOCATION}
          </p>

          <div className="note-row">
            {note?.trim()
              ? <span className="note-chip" title={note}>Note: {note.length > 40 ? `${note.slice(0, 40)}…` : note}</span>
              : <span className="note-chip muted">No note added</span>}
            <button className="note-btn" type="button" onClick={() => setNoteOpen(true)}>
              {note?.trim() ? "Edit note" : "Add a note"}
            </button>
          </div>

          <div className="inspo-row">
            {inspoImg?.trim() ? (
              <button type="button" className="inspo-chip" onClick={() => setImgOpen(true)} title="Change image">
                <img src={inspoImg} alt="Inspo" />
                <span>Edit image</span>
              </button>
            ) : (
              <button type="button" className="inspo-add" onClick={() => setImgOpen(true)}>
                + Add inspo image
              </button>
            )}
          </div>

          <button
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={!loggedUser?.userID}
            title={!loggedUser?.userID ? "Log in to book" : undefined}
          >
            {loggedUser?.userID ? "Confirm Appointment" : "Log in to book"}
          </button>
        </>
      )}

      {confirmed && (
        <p className="success-message">
          We are waiting for you on <strong>{prettyDate}</strong> at <strong>{selectedTime}</strong>
          <br /> Location: {LOCATION}
          {note?.trim() ? (<><br /><em>Note saved:</em> “{note}”</>) : null}
          {inspoImg?.trim() ? (<><br /><img className="inspo-final" src={inspoImg} alt="Inspo" /></>) : null}
        </p>
      )}

      {/* Modals */}
      <NoteModal open={noteOpen} initialValue={note} onClose={() => setNoteOpen(false)} onSave={setNote} />
      <ImageModal open={imgOpen} initialUrl={inspoImg} onClose={() => setImgOpen(false)} onSave={setInspoImg} />
    </div>
  );
}
