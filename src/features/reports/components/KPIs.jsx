import React from "react";

export default function KPIs({ totalAppts, totalRevenue, maxAppts, maxRevenue, money, num, loading }) {
  return (
    <div className={`rep-kpis ${loading ? "is-loading" : ""}`}>
      <div className="kpi pop">
        <div className="kpi-label">Total Appointments</div>
        <div className="kpi-value">{num(totalAppts)}</div>
      </div>
      <div className="kpi pop">
        <div className="kpi-label">Total Revenue</div>
        <div className="kpi-value">{money(totalRevenue)}</div>
      </div>
      <div className="kpi pop">
        <div className="kpi-label">Max / month (Appts)</div>
        <div className="kpi-value">{num(maxAppts)}</div>
      </div>
      <div className="kpi pop">
        <div className="kpi-label">Max / month (Revenue)</div>
        <div className="kpi-value">{money(maxRevenue)}</div>
      </div>
    </div>
  );
}
