import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function RevenueChart({ rows, bottomMargin, money }) {
  return (
    <section className="rep-card fade-up delay-1">
      <div className="rep-card-head">
        <h2>Revenue per month</h2>
        <p className="muted">Sum of paid amounts of closed appointments</p>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: bottomMargin, left: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--grad-c)" />
                <stop offset="100%" stopColor="var(--grad-d)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" interval={0} tickMargin={8} tick={{ fontSize: 11 }} dy={6} />
            <YAxis tickFormatter={(v) => `₪${v}`} />
            <Tooltip formatter={(v) => [money(v), "Revenue"]} />
            <Legend />
            <Bar className="bar-revenue" dataKey="revenue" name="Revenue" fill="var(--bar-revenue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
