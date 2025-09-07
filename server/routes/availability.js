// server/routes/availability.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import { loadTimes } from "../lib/times.js";
import { getMyEventRow } from "../lib/myEvents.js";

const r = Router();

function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

/**
 * GET /api/availability?date=YYYY-MM-DD
 * Response: { ok: true, available: ["HH:MM", ...] }
 */
r.get("/availability", async (req, res) => {
  try {
    const { date } = req.query;
    if (!isISODate(date)) {
      return res.status(400).json({ ok: false, error: "Missing or bad date" });
    }

    // slot times (["HH:MM", ...])
    const { arr } = await loadTimes(); // defaults to global pool, id=1

    // read taken slots from workday (non-empty strings mean taken)
    const [rows] = await pool.execute(
      "SELECT firstApp, secondApp, thirdApp, fourthApp, fifthApp FROM workday WHERE workDate = ? LIMIT 1",
      [date]
    );

    const taken = new Set();
    if (rows.length) {
      const w = rows[0] || {};
      if (String(w.firstApp || "").trim())  taken.add(arr[0]);
      if (String(w.secondApp || "").trim()) taken.add(arr[1]);
      if (String(w.thirdApp || "").trim())  taken.add(arr[2]);
      if (String(w.fourthApp || "").trim()) taken.add(arr[3]);
      if (String(w.fifthApp || "").trim())  taken.add(arr[4]);
    }

    // also treat disabled flags in myEvents as taken
    const ev = await getMyEventRow(pool, date); // creates defaults if missing
    if (ev) {
      if (!ev.firstApp)  taken.add(arr[0]);
      if (!ev.secondApp) taken.add(arr[1]);
      if (!ev.thirdApp)  taken.add(arr[2]);
      if (!ev.fourthApp) taken.add(arr[3]);
      if (!ev.fifthApp)  taken.add(arr[4]);
    }

    const available = arr.filter((t) => !taken.has(t));
    return res.json({ ok: true, available });
  } catch (e) {
    console.error("[availability]", e?.sqlMessage || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default r;
