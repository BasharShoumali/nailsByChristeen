import "../HomePage.css";

function formatPretty(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  const month = dt.toLocaleDateString(undefined, { month: "short" });
  const day = dt.toLocaleDateString(undefined, { day: "2-digit" });
  return { weekday, month, day };
}

export default function DateBar({ datesIso, selectedDate, onSelectDate }) {
  return (
    <div className="date-bar">
      {datesIso.map((iso) => {
        const { weekday, month, day } = formatPretty(iso);
        const active = selectedDate === iso ? "active" : "";
        return (
          <button
            type="button"
            key={iso}
            className={`date-card ${active}`}
            onClick={() => onSelectDate(iso)}
            aria-pressed={active ? "true" : "false"}
          >
            <span className="date-top">{weekday}</span>
            <span className="date-mid">{day}</span>
            <span className="date-bot">{month}</span>
          </button>
        );
      })}
    </div>
  );
}
