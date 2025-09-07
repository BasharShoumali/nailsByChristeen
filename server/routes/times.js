import { Router } from "express";
import { pool } from "../db/pool.js";
import { loadTimes, clearTimesCache } from "../lib/times.js";
import { getUserRole } from "../lib/users.js";

const r = Router();

// GET /api/times?id=1  -> { ok, times:[..], id }
r.get("/times", async (req, res) => {
  try {
    const id = Number(req.query.id) || 1;
    const { arr } = await loadTimes(pool, id);
    res.json({ ok: true, times: arr, id });
  } catch (e) {
    console.error("[GET /api/times]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// PATCH /api/times?id=1  body: { firstApp,...,fifthApp }  (Managers only)
r.patch("/times", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.query.id) || 1;

    const callerID = Number(req.get("x-user-id") || 0);
    const role = await getUserRole(conn, callerID);
    if (role !== "manager") return res.status(403).json({ ok: false, error: "Managers only" });

    const keys = ["firstApp", "secondApp", "thirdApp", "fourthApp", "fifthApp"];
    const raw = keys.map((k) => String(req.body?.[k] ?? "").trim());

    if (raw.some((s) => !/^\d{2}:\d{2}(:\d{2})?$/.test(s))) {
      return res.status(400).json({ ok: false, error: "Times must be HH:MM or HH:MM:SS" });
    }

    const hmSet = new Set(raw.map((s) => s.slice(0, 5)));
    if (hmSet.size !== 5) return res.status(400).json({ ok: false, error: "Times must be distinct" });

    const asHMS = raw.map((s) => (s.length === 5 ? `${s}:00` : s));

    await conn.execute(
      `INSERT INTO timesOfAppointments (id, firstApp, secondApp, thirdApp, fourthApp, fifthApp)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         firstApp = VALUES(firstApp),
         secondApp = VALUES(secondApp),
         thirdApp = VALUES(thirdApp),
         fourthApp = VALUES(fourthApp),
         fifthApp = VALUES(fifthApp)`,
      [id, ...asHMS]
    );

    clearTimesCache(); // reset all ids; simple & safe
    const { arr } = await loadTimes(conn, id);
    res.json({ ok: true, id, times: arr });
  } catch (e) {
    console.error("[PATCH /api/times]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

// POST /api/admin/times/refresh?id=1  -> clear cache (all if id omitted)
r.post("/admin/times/refresh", (req, res) => {
  try {
    clearTimesCache(); // global clear is fine; avoids leaking internal map
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "refresh failed" });
  }
});

export default r;
