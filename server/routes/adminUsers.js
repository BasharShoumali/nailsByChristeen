// server/routes/adminUsers.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { bookAppointmentTx } from "../lib/booking.js";

const r = Router();

function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}
function isHMTime(s) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
}

/** GET /api/admin/users  -> list users (+ closedCount, revenue) */
r.get("/admin/users", async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    // base users
    const [[countRow]] = await conn.query(`SELECT COUNT(*) AS n FROM users`);
    const usersCount = Number(countRow?.n || 0);

    const [rows] = await conn.query(`SELECT * FROM users`);
    const users = rows.map((r) => {
      const { password, password_hash, passwd, pass, pwd, hash, ...safe } = r;
      return safe;
    });

    // per-user stats from appointments
    const [statsRows] = await conn.query(
      `
      SELECT
        userID,
        SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closedCount,
        COALESCE(SUM(CASE WHEN status='closed' THEN paid_amount ELSE 0 END), 0) AS revenue
      FROM appointments
      GROUP BY userID
      `
    );

    const statsMap = new Map(
      statsRows.map(r => [Number(r.userID), {
        closedCount: Number(r.closedCount || 0),
        revenue: Number(r.revenue || 0),
      }])
    );

    for (const u of users) {
      const s = statsMap.get(Number(u.userID)) || { closedCount: 0, revenue: 0 };
      u.closedCount = s.closedCount;
      u.revenue = s.revenue;
    }

    // sort by userNumber then userID (both numeric if present)
    users.sort((a, b) => {
      const av = Number(a.userNumber ?? Number.MAX_SAFE_INTEGER);
      const bv = Number(b.userNumber ?? Number.MAX_SAFE_INTEGER);
      if (av !== bv) return av - bv;
      const au = Number(a.userID ?? Number.MAX_SAFE_INTEGER);
      const bu = Number(b.userID ?? Number.MAX_SAFE_INTEGER);
      return au - bu;
    });

    res.json({ ok: true, count: usersCount, users });
  } catch (e) {
    console.error("[/api/admin/users]", e?.sqlMessage || e?.message || e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

/** POST /api/admin/users/:userId/appointments
 *  Body: { date:'YYYY-MM-DD', time:'HH:MM', notes? }
 *  Creates an appointment for this user (atomic).
 */
r.post("/admin/users/:userId/appointments", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userID = Number(req.params.userId);
    const { date, time, notes } = req.body || {};

    if (!Number.isFinite(userID)) {
      conn.release();
      return res.status(400).json({ ok: false, error: "Bad userId" });
    }
    if (!isISODate(date) || !isHMTime(time)) {
      conn.release();
      return res.status(400).json({ ok: false, error: "Bad date or time" });
    }

    await bookAppointmentTx(conn, {
      userID,
      date,
      time,
      notes: notes || null,
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    const status =
      e?.status ||
      (e?.code === "CONFLICT" ? 409 :
       e?.code === "ER_DUP_ENTRY" ? 409 :
       e?.code === "BAD_TIME" ? 400 : 500);

    const msg =
      e?.status ? e.message :
      e?.code === "CONFLICT" ? "That time is already booked" :
      e?.code === "ER_DUP_ENTRY" ? "That time is already booked" :
      e?.code === "BAD_TIME" ? "Invalid time" :
      "Server error";

    console.error("[admin create appt]", e?.sqlMessage || e?.message || e);
    res.status(status).json({ ok: false, error: msg });
  } finally {
    conn.release();
  }
});

export default r;
