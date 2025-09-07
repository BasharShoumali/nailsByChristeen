import { pool } from "../db/pool.js";
import { loadTimes, SLOT_COLS } from "./times.js";
import { getUserDisplay } from "./users.js";

/** TRUE/FALSE coercion with default */
export function toBool(v, def = true) {
  if (v === undefined || v === null) return def;
  return !!(v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true");
}

/** Ensure row exists (defaults TRUE) and return it */
export async function getMyEventRow(connOrPool, date) {
  const [[row]] = await connOrPool.query(
    `SELECT workDate, firstApp, secondApp, thirdApp, fourthApp, fifthApp
       FROM myEvents WHERE workDate=?`,
    [date]
  );
  if (row) return row;
  await connOrPool.query(`INSERT IGNORE INTO myEvents (workDate) VALUES (?)`, [date]);
  return { workDate: date, firstApp: 1, secondApp: 1, thirdApp: 1, fourthApp: 1, fifthApp: 1 };
}

/** Admin “hold” in a txn: fill workday col + insert open appt marker */
export async function holdSlotForAdmin(conn, { adminUserID, date, col }) {
  const { map, toHMS } = await loadTimes(conn);
  // col like 'firstApp' -> HH:MM
  const idx = SLOT_COLS.indexOf(col);
  if (idx < 0) return;
  const timeHM = [...map.keys()][idx];

  const display = await getUserDisplay(conn, adminUserID);
  await conn.execute(
    "INSERT INTO workday (workDate) VALUES (?) ON DUPLICATE KEY UPDATE workDate = workDate",
    [date]
  );
  await conn.execute(
    `UPDATE workday SET ${col} = ? WHERE workDate = ? AND (${col} IS NULL OR ${col} = '')`,
    [display, date]
  );
  await conn.execute(
    `INSERT IGNORE INTO appointments (userID, workDate, slot, status, notes)
     VALUES (?, ?, ?, 'open', 'admin hold via myEvents')`,
    [adminUserID, date, toHMS(timeHM)]
  );
}

/** Release admin hold for a slot/date (txn-friendly) */
export async function releaseSlotAdminHold(conn, { date, col }) {
  const { map } = await loadTimes(conn);
  const idx = SLOT_COLS.indexOf(col);
  if (idx < 0) return;
  const timeHM = [...map.keys()][idx];

  const [apps] = await conn.query(
    `
    SELECT id, userID
    FROM appointments
    WHERE workDate = ?
      AND TIME_FORMAT(slot,'%H:%i') = ?
      AND notes = 'admin hold via myEvents'
      AND status = 'open'
    FOR UPDATE
    `,
    [date, timeHM]
  );

  for (const ap of apps) {
    await conn.execute(`UPDATE appointments SET status='canceled' WHERE id = ?`, [ap.id]);
    const display = await getUserDisplay(conn, ap.userID);
    await conn.execute(
      `UPDATE workday SET ${col} = NULL WHERE workDate = ? AND ${col} = ?`,
      [date, display]
    );
  }
}
