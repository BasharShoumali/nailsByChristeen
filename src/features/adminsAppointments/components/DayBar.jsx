import { useMemo } from "react";
import { addDays, formatISOLocal } from "../utils";

export default function DayBar({ selectedDate, onSelect, loading }) {
  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 10 }, (_, i) => {
      const d = addDays(start, i);
      return {
        iso: formatISOLocal(d),
        dow: d.toLocaleDateString(undefined, { weekday: "short" }),
        mday: d.toLocaleDateString(undefined, { day: "2-digit" }),
        month: d.toLocaleDateString(undefined, { month: "short" }),
      };
    });
  }, []);

  const todayISO = formatISOLocal(new Date());

  return (
    <div className="aa-daybar" role="tablist" aria-label="Next days">
      {days.map((d) => {
        const active = d.iso === selectedDate;
        const isToday = d.iso === todayISO;
        return (
          <button
            key={d.iso}
            role="tab"
            aria-selected={active}
            className={`aa-chip ${active ? "active" : ""} ${isToday ? "today" : ""}`}
            onClick={() => onSelect?.(d.iso)}
            title={d.iso}
            type="button"
            disabled={loading && !active}
            style={{ willChange: "transform, box-shadow" }}
          >
            <span className="aa-chip-dow">{d.dow}</span>
            <span className="aa-chip-mday">{d.mday}</span>
            <span className="aa-chip-month">{d.month}</span>
          </button>
        );
      })}
    </div>
  );
}
