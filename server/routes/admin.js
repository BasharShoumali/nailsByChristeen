import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

/**
 * GET /api/admin/schedule?date=YYYY-MM-DD
 * Returns raw rows for a given date (admin view)
 */
r.get("/admin/schedule", async (req, res) => {
  try {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
      return res.status(400).json({ ok: false, error: "Bad or missing date" });
    }

    const [rows] = await pool.execute(
      `
      SELECT
        a.id,
        a.workDate,
        TIME_FORMAT(a.slot,'%H:%i') AS slot,
        a.status,
        a.notes,
        a.inspo_img, 
        COALESCE(a.paidAmount, a.paid_amount, 0) AS paidAmount,  -- ✅ prefer paidAmount, fallback paid_amount
        u.userID,
        u.userName,
        u.firstName,
        u.lastName,
        u.phoneNumber
      FROM appointments a
      JOIN users u ON u.userID = a.userID
      WHERE a.workDate = ?
      ORDER BY a.slot ASC
      `,
      [date]
    );

    res.json({ ok: true, schedule: rows });
  } catch (e) {
    console.error("[admin schedule]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * GET /api/admin/workdays?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns workday flags between dates
 */
r.get("/admin/workdays", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: "Missing from/to" });
    }

    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(from) || !re.test(to)) {
      return res.status(400).json({ ok: false, error: "Bad date format" });
    }

    const [rows] = await pool.execute(
      `
      SELECT workDate, firstApp, secondApp, thirdApp, fourthApp, fifthApp
      FROM workday
      WHERE workDate BETWEEN ? AND ?
      ORDER BY workDate ASC
      `,
      [from, to]
    );

    res.json({ ok: true, workdays: rows });
  } catch (e) {
    console.error("[admin workdays]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * GET /api/admin/schedule2?date=YYYY-MM-DD
 * Returns normalized schedule with UI-friendly fields + totalPaid
 */
r.get("/admin/schedule2", async (req, res) => {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({ ok: false, error: "Bad or missing date" });
  }

  try {
    const [rows] = await pool.query(
      `
      SELECT
        a.id,
        a.userID,
        a.workDate,
        TIME_FORMAT(a.slot,'%H:%i') AS slot,
        a.status,
        a.notes,
        a.inspo_img,
        COALESCE(a.paidAmount, a.paid_amount, 0) AS paidAmount,  -- ✅ prefer paidAmount, fallback paid_amount
        u.userName,
        u.firstName,
        u.lastName,
        u.phoneNumber
      FROM appointments a
      JOIN users u ON u.userID = a.userID
      WHERE a.workDate = ?
        AND a.status IN ('open','closed')
      ORDER BY a.slot ASC
      `,
      [date]
    );

    const schedule = [];
    let totalPaid = 0;

    for (const r of rows) {
      const statusUi = r.status === "closed" ? "done" : "open";
      // r.paidAmount is already numeric-ish from SQL; coerce safely:
      const amt = r.paidAmount != null ? Number(r.paidAmount) : null;
      if (statusUi === "done" && amt != null) totalPaid += amt;

      schedule.push({
        id: r.id,
        workDate: date,
        slot: (r.slot || "").slice(0, 5), // "HH:MM"
        status: statusUi,
        paidAmount: amt,
        notes: r.notes ?? null,
        inspo_img: r.inspo_img ?? null,
        userID: r.userID,
        userName: r.userName || "",
        firstName: r.firstName || "",
        lastName: r.lastName || "",
        phoneNumber: r.phoneNumber || "",
      });
    }

    return res.json({ ok: true, schedule, totalPaid });
  } catch (e) {
    console.error("[admin schedule2]", e?.sqlMessage || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default r;
