import { loadTimes } from "./times.js";

export async function bookAppointmentTx(
  conn,
  { userID, date, time, notes, inspo_img = null, location = null }
) {
  const { map, toHMS } = await loadTimes(conn);
  const hhmm = String(time).slice(0, 5);
  const col = map.get(hhmm);
  if (!col) {
    const err = new Error("Invalid time");
    err.code = "BAD_TIME";
    throw err;
  }

  const safeNotes = typeof notes === "string" ? notes.trim().slice(0, 1000) : null;
  const safeImg = typeof inspo_img === "string" && inspo_img.trim() ? inspo_img.trim().slice(0, 1024) : null;
  const safeLocation = typeof location === "string" && location.trim() ? location.trim().slice(0, 255) : null;

  await conn.beginTransaction();
  try {
    await conn.execute(
      "INSERT INTO workday (workDate) VALUES (?) ON DUPLICATE KEY UPDATE workDate = workDate",
      [date]
    );

    const [u1] = await conn.execute(
      `UPDATE workday SET ${col} = COALESCE(NULLIF(${col}, ''), ?) 
       WHERE workDate = ? AND (${col} IS NULL OR ${col} = '')`,
      [String(userID), date]
    );
    if (u1.affectedRows !== 1) {
      const err = new Error("Slot already taken");
      err.code = "CONFLICT";
      throw err;
    }

    await conn.execute(
      `INSERT INTO appointments
         (userID, workDate, slot, status, notes, inspo_img, location, created_at)
       VALUES
         (?, ?, ?, 'open', ?, ?, ?, NOW())`,
      [userID, date, toHMS(hhmm), safeNotes, safeImg, safeLocation]
    );

    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch {}
    if (e?.code === "ER_DUP_ENTRY") {
      const err = new Error("That time is already booked");
      err.code = "CONFLICT";
      throw err;
    }
    throw e;
  }
}
