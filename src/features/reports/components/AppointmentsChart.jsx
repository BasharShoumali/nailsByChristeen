import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function AppointmentsChart({ rows, bottomMargin }) {
  return (
    <section className="rep-card fade-up">
      <div className="rep-card-head">
        <h2>Appointments per month</h2>
        <p className="muted">Counts of appointments per month</p>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: bottomMargin, left: 0 }}>
            <defs>
              <linearGradient id="gradAppts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--grad-a)" />
                <stop offset="100%" stopColor="var(--grad-b)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" interval={0} tickMargin={8} tick={{ fontSize: 11 }} dy={6} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => [Number(v).toLocaleString(), "Appointments"]} />
            <Legend />
            <Bar className="bar-appts" dataKey="appts" name="Appointments" fill="var(--bar-appts)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
