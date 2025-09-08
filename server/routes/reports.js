// server/routes/reports.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

/**
 * GET /api/admin/reports/monthly?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aggregates appointments by calendar month:
 *  - counts total appts
 *  - sums revenue from rows with status='closed' (paid_amount)
 *
 * If no query params are provided:
 *   from = first day 11 months ago
 *   to   = first day of the current month
 *
 * Returns:
 * {
 *   ok: true,
 *   from: "YYYY-MM-DD",
 *   to: "YYYY-MM-DD",
 *   months: [
 *     { ym: "2025-01", year: 2025, month: 1, appts: 12, revenue: 350 },
 *     ...
 *   ]
 * }
 */
r.get("/admin/reports/monthly", async (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;

    // defaults: trailing 12 months window, inclusive of 'from' month, exclusive of ('to'+1 month)
    const today = new Date();
    const defaultTo   = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 11, 1).toISOString().slice(0, 10);

    const from = re.test(String(req.query.from || "")) ? req.query.from : defaultFrom;
    const to   = re.test(String(req.query.to   || "")) ? req.query.to   : defaultTo;

    // Validate 'from' <= 'to'
    if (from > to) {
      return res.status(400).json({ ok: false, error: "`from` must be <= `to` (YYYY-MM-DD)" });
    }

    // NOTE: we compare DATE(workDate) to keep things safe if workDate is DATETIME in your schema
    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(workDate, '%Y-%m') AS ym,
        YEAR(workDate)  AS y,
        MONTH(workDate) AS m,
        COUNT(*) AS appts,
        COALESCE(SUM(CASE WHEN status='closed' THEN paidAmount ELSE 0 END), 0) AS revenue
      FROM appointments
      WHERE DATE(workDate) >= ?
        AND DATE(workDate) < DATE_ADD(?, INTERVAL 1 MONTH)
      GROUP BY ym, y, m
      ORDER BY y ASC, m ASC
      `,
      [from, to]
    );

    const months = rows.map(r => ({
      ym: String(r.ym),
      year: Number(r.y),
      month: Number(r.m),
      appts: Number(r.appts || 0),
      revenue: Number(r.revenue || 0),
    }));

    return res.json({ ok: true, from, to, months });
  } catch (e) {
    console.error("[reports/monthly]", e?.sqlMessage || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default r;
