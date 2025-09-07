import { Router } from "express";
import { pool } from "../db/pool.js";
import { SLOT_COLS } from "../lib/times.js";
import { getMyEventRow, holdSlotForAdmin, releaseSlotAdminHold, toBool } from "../lib/myEvents.js";
import { getUserRole } from "../lib/users.js";

const r = Router();

function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

// GET /api/my-events/:date
r.get("/my-events/:date", async (req, res) => {
  try {
    const date = String(req.params.date || "");
    if (!isISODate(date)) return res.status(400).json({ ok: false, error: "Bad date" });

    const row = await getMyEventRow(pool, date);
    return res.json({ ok: true, event: row });
  } catch (e) {
    console.error("[GET my-events/:date]", e?.sqlMessage || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// PATCH /api/my-events/:date
r.patch("/my-events/:date", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const date = String(req.params.date || "");
    if (!isISODate(date)) return res.status(400).json({ ok: false, error: "Bad date" });

    const callerID = Number(req.get("x-user-id") || 0);
    const role = await getUserRole(conn, callerID);
    if (role !== "manager") return res.status(403).json({ ok: false, error: "Managers only" });

    const onlyKey = String(req.body?.only || "");
    const hasOnly = onlyKey && SLOT_COLS.includes(onlyKey);

    const incoming = {
      firstApp: toBool(req.body?.firstApp, undefined),
      secondApp: toBool(req.body?.secondApp, undefined),
      thirdApp: toBool(req.body?.thirdApp, undefined),
      fourthApp: toBool(req.body?.fourthApp, undefined),
      fifthApp: toBool(req.body?.fifthApp, undefined),
    };

    const nextFlags = hasOnly
      ? Object.fromEntries(SLOT_COLS.map((c) => [c, c === onlyKey]))
      : { ...incoming };

    await conn.beginTransaction();

    const prev = await getMyEventRow(conn, date);

    for (const c of SLOT_COLS) {
      nextFlags[c] = nextFlags[c] === undefined ? !!prev[c] : !!nextFlags[c];
    }

    await conn.execute(
      `INSERT INTO myEvents (workDate, firstApp, secondApp, thirdApp, fourthApp, fifthApp)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         firstApp = VALUES(firstApp),
         secondApp= VALUES(secondApp),
         thirdApp = VALUES(thirdApp),
         fourthApp= VALUES(fourthApp),
         fifthApp = VALUES(fifthApp)`,
      [
        date,
        nextFlags.firstApp,
        nextFlags.secondApp,
        nextFlags.thirdApp,
        nextFlags.fourthApp,
        nextFlags.fifthApp,
      ]
    );

    for (const col of SLOT_COLS) {
      const was = !!prev[col];
      const now = !!nextFlags[col];
      if (was && !now) await holdSlotForAdmin(conn, { adminUserID: callerID, date, col });
      else if (!was && now) await releaseSlotAdminHold(conn, { date, col });
    }

    await conn.commit();
    return res.json({ ok: true, event: { workDate: date, ...nextFlags } });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("[PATCH my-events/:date]", e?.sqlMessage || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

export default r;
