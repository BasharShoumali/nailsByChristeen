import React, { useEffect, useMemo, useState } from "react";
import "../../../cssFiles/Reports.css";
import { reportsApi } from "../api";
import {
  defaultRange,
  buildClientMonths,
  ymdLocal,
  money,
  num,
} from "../utils";
import { useMedia, usePrefersReducedMotion } from "../hooks";
import RangeToolbar from "../components/RangeToolBar";
import KPIs from "../components/KPIs";
import AppointmentsChart from "../components/AppointmentsChart";
import RevenueChart from "../components/RevenueChart";

export default function ReportsPage() {
  const def = useMemo(defaultRange, []);
  const [from, setFrom] = useState(def.fromISO);
  const [to, setTo] = useState(def.toISO);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");
  const [rows, setRows] = useState([]);

  // preferences / responsive
  usePrefersReducedMotion();
  const isPhone = useMedia("(max-width: 480px)");
  const isTablet = useMedia("(max-width: 834px)");
  const chartBottom = isPhone ? 72 : isTablet ? 56 : 40;

  async function load() {
    setLoading(true);
    setErr("");
    setWarn("");

    // skeleton first for immediate UI
    const skeleton = buildClientMonths(from, to);
    setRows(skeleton);

    try {
      const [fy, fm] = from.split("-").map(Number);
      const [ty, tm] = to.split("-").map(Number);
      const qFrom = ymdLocal(new Date(fy, (fm || 1) - 1, 1));
      const qTo = ymdLocal(new Date(ty, (tm || 1) - 1, 1));

      const data = await reportsApi.monthly(qFrom, qTo);

      if (!data?.ok) {
        setWarn("Report API returned no data; showing zeros.");
        setLoading(false);
        return;
      }

      const map = new Map((data.months || []).map((r) => [r.ym, r]));
      const merged = skeleton.map((m) => {
        const found = map.get(m.ym);
        return found
          ? { ...m, appts: Number(found.appts || 0), revenue: Number(found.revenue || 0) }
          : m;
      });

      if (!data.months || data.months.length === 0) {
        setWarn("No rows for this range; showing zeros.");
      }

      setRows(merged);
    } catch (e) {
      setErr(e?.message || "Error");
      setWarn("Could not reach /admin/reports/monthly; showing zeros.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* initial */ }, []); // eslint-disable-line
  useEffect(() => { load(); /* on range change */ }, [from, to]); // eslint-disable-line

  const totalAppts = useMemo(() => rows.reduce((s, r) => s + (r.appts || 0), 0), [rows]);
  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + (r.revenue || 0), 0), [rows]);
  const maxAppts = useMemo(() => Math.max(0, ...rows.map((r) => r.appts)), [rows]);
  const maxRevenue = useMemo(() => Math.max(0, ...rows.map((r) => r.revenue)), [rows]);

  return (
    <div className="rep-wrap">
      <RangeToolbar
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        loading={loading}
        err={err}
        warn={warn}
      />

      <KPIs
        totalAppts={totalAppts}
        totalRevenue={totalRevenue}
        maxAppts={maxAppts}
        maxRevenue={maxRevenue}
        money={money}
        num={num}
        loading={loading}
      />

      <AppointmentsChart rows={rows} bottomMargin={chartBottom} />
      <RevenueChart rows={rows} bottomMargin={chartBottom} money={money} />
    </div>
  );
}
