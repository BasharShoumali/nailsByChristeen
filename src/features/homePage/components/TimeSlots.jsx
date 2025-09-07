import "../HomePage.css";

export default function TimeSlots({
  dateIso,
  times,
  taken = [],
  selectedTime,
  onSelectTime,
  loading,
}) {
  const pretty = new Date(dateIso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const takenSet = new Set(taken);

  return (
    <div className="times-section">
      <h2>Available times for {pretty}</h2>

      {loading ? (
        <div className="time-grid">
          <div className="time-skeleton" />
          <div className="time-skeleton" />
          <div className="time-skeleton" />
        </div>
      ) : (
        <div className="time-grid">
          {times.map((t) => {
            const disabled = takenSet.has(t);
            const classes = [
              "time-card",
              selectedTime === t ? "active-time" : "",
              disabled ? "is-disabled" : "",
            ].join(" ");
            return (
              <button
                key={t}
                className={classes}
                onClick={() => !disabled && onSelectTime(t)}
                type="button"
                disabled={disabled}
                title={disabled ? "Already booked" : "Select time"}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
