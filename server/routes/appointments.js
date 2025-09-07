import { Router } from "express";
import { pool } from "../db/pool.js";
import { loadTimes } from "../lib/times.js";
import { bookAppointmentTx } from "../lib/booking.js";

const r = Router();

/* ------------------------- helpers ------------------------- */
function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
function isHMTime(s) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(s || "")); }

async function getUserRole(connOrPool, userID) {
  const [[row]] = await connOrPool.query(`SELECT role FROM users WHERE userID=?`, [userID]);
  return row?.role || "user";
}

function toSafeImg(u) {
  if (typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (s.startsWith("/uploads/") && !s.includes("..")) return s.slice(0, 1024);
  try {
    const url = new URL(s);
    if (url.protocol === "http:" || url.protocol === "https:") return s.slice(0, 1024);
    return null;
  } catch { return null; }
}

function toSafeNote(v) {
  return typeof v === "string" ? v.trim().slice(0, 1000) : null;
}

/* ----------------- Create appointment ----------------- */
r.post("/appointments", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { userID, date, time, location, notes, inspo_img } = req.body || {};

    if (!userID || !isISODate(date) || !isHMTime(time)) {
      conn.release();
      return res.status(400).json({ ok: false, error: "Missing or bad fields" });
    }

    const role = await getUserRole(conn, Number(userID));

    const { map } = await loadTimes(conn);
    const hhmm = String(time).slice(0, 5);
    if (!map.has(hhmm)) {
      conn.release();
      return res.status(400).json({ ok: false, error: "Invalid time" });
    }

    const col = map.get(hhmm);
    const [[ev]] = await conn.query(
      `SELECT ${col} AS allowed FROM myEvents WHERE workDate=?`,
      [date]
    );
    if (ev && !ev.allowed && role !== "manager") {
      conn.release();
      return res.status(403).json({ ok: false, error: "This slot is closed by admin" });
    }

    const safeNote = toSafeNote(notes);
    const safeImg = toSafeImg(inspo_img);

    await bookAppointmentTx(conn, {
      userID: Number(userID),
      date,
      time: hhmm,
      notes: safeNote,
      inspo_img: safeImg,
      location: location || null,
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("[appointments:create]", e);

    if (e?.code === "CONFLICT" || e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, error: "That time is already booked" });
    }
    if (e?.code === "BAD_TIME") {
      return res.status(400).json({ ok: false, error: "Invalid time" });
    }

    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

/* ----------------- List appointments for user ----------------- */
r.get("/my/appointments", async (req, res) => {
  try {
    const { userID, status = "open" } = req.query;
    if (!userID) {
      return res.status(400).json({ ok: false, error: "Missing userID" });
    }

    const params = [userID];
    let whereStatus = "";
    if (status !== "all") {
      whereStatus = " AND status = ? ";
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT 
         id,
         workDate,
         TIME_FORMAT(slot,'%H:%i') AS slot,
         status,
         IFNULL(notes,'')       AS notes,
         IFNULL(inspo_img,'')   AS inspo_img,
         IFNULL(location,'')    AS location,
         IFNULL(paidAmount, 0)  AS paidAmount,   -- ✅ include amount
         closed_at,                              -- (optional) expose close time
         created_at,
         updated_at
       FROM appointments
       WHERE userID = ? ${whereStatus}
       ORDER BY workDate DESC, slot ASC`,
      params
    );

    res.json({ ok: true, appointments: rows });
  } catch (e) {
    console.error("[my appointments]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ----------------- Update appointment status ----------------- */
r.patch("/appointments/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status, paidAmount } = req.body || {};

    if (!["open", "closed", "canceled"].includes(status)) {
      conn.release();
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }

    // when closing, amount must be present and numeric
    if (status === "closed" && (paidAmount == null || Number.isNaN(Number(paidAmount)))) {
      conn.release();
      return res.status(400).json({ ok: false, error: "paidAmount required when closing" });
    }

    await conn.beginTransaction();

    const [[appt]] = await conn.query(
      "SELECT id, status, workDate, TIME_FORMAT(slot,'%H:%i') AS slotHM FROM appointments WHERE id = ? FOR UPDATE",
      [id]
    );
    if (!appt) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    // freeing the slot on cancel
    if (status === "canceled") {
      const { map } = await loadTimes(conn);
      const col = map.get(appt.slotHM);
      if (col) {
        await conn.execute(`UPDATE workday SET ${col} = NULL WHERE workDate = ?`, [appt.workDate]);
      }
      await conn.execute("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
    }
    // writing amount + timestamp on close
    else if (status === "closed") {
      await conn.execute(
        "UPDATE appointments SET status = ?, paidAmount = ?, closed_at = NOW() WHERE id = ?",
        [status, Number(paidAmount), id]
      );
    }
    // just update status for 'open'
    else {
      await conn.execute("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("[update appointment]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

export default r;
