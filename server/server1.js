import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";



const app = express();

// JSON FIRST
app.use(express.json({ limit: "256kb" }));
app.use(cors({ origin: ["http://localhost:5173","http://localhost:3000"], credentials: false }));

// Make the pool once
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// (optional) health + route logger
app.get("/api/health", async (_req, res) => {
  try {
    const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");
    res.json({ ok: true, db: dbRow?.db || null });
  } catch {
    res.status(500).json({ ok: false, error: "db" });
  }
});

// ---- replace the old TIME_TO_COL / FIXED_TIMES / TIME_ORDER with this ----
let cachedTimes = null; // { arr: [ '10:30','12:30','15:00','17:00','19:00' ], map: Map<'HH:MM','firstApp'|...> }
let cachedAt = 0;


/* ------------------------------Load Times------------------------------- */
// --- dynamic slot times loader (cache 30s) ---
let _timesCache = null;
let _timesAt = 0;


// ===== myEvents bootstrap (table + useful index) =====
const SLOT_COLS = ["firstApp","secondApp","thirdApp","fourthApp","fifthApp"];

async function initMyEvents() {
  // 0. table for flags (defaults TRUE)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS myEvents (
      workDate   DATE PRIMARY KEY,
      firstApp   BOOLEAN NOT NULL DEFAULT TRUE,
      secondApp  BOOLEAN NOT NULL DEFAULT TRUE,
      thirdApp   BOOLEAN NOT NULL DEFAULT TRUE,
      fourthApp  BOOLEAN NOT NULL DEFAULT TRUE,
      fifthApp   BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // 1. helpful uniqueness: avoid double-booking same date/slot
  try {
    await pool.query(`ALTER TABLE appointments ADD UNIQUE KEY uq_workdate_slot (workDate, slot)`);
  } catch (e) {
    // ignore "duplicate key name" etc if it already exists
    if (!(e && (e.code === "ER_DUP_KEYNAME" || e.code === "ER_DUP_FIELDNAME" || e.errno === 1061))) {
      console.error("[initMyEvents] add unique failed:", e?.sqlMessage || e);
    }
  }
}
async function getUserRole(connOrPool, userID) {
  const [[row]] = await connOrPool.query(`SELECT role FROM users WHERE userID=?`, [userID]);
  return row?.role || "user";
}

function toBool(v, def = true) {
  if (v === undefined || v === null) return def;
  return !!(v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true");
}

/** Map a slot column name to HH:MM using current timesOfAppointments */
async function colToTimeHM(connOrPool, colName) {
  const { arr } = await loadTimes(connOrPool);
  const idx = SLOT_COLS.indexOf(colName);
  return idx >= 0 ? arr[idx] : null;
}

/** Ensure myEvents row exists (defaults = TRUE) and return it */
async function getMyEventRow(connOrPool, date) {
  const [[row]] = await connOrPool.query(
    `SELECT workDate, firstApp, secondApp, thirdApp, fourthApp, fifthApp FROM myEvents WHERE workDate=?`,
    [date]
  );
  if (row) return row;
  // insert defaults (TRUE) if missing, return defaults
  await connOrPool.query(`INSERT IGNORE INTO myEvents (workDate) VALUES (?)`, [date]);
  return { workDate: date, firstApp: 1, secondApp: 1, thirdApp: 1, fourthApp: 1, fifthApp: 1 };
}

/** Book an admin "hold" in the current transaction (uses existing conn txn) */
async function holdSlotForAdmin(conn, { adminUserID, date, col }) {
  const { map, toHMS } = await loadTimes(conn);
  const timeHM = await colToTimeHM(conn, col);
  if (!timeHM || !map.has(timeHM)) return; // not a configured slot

  const display = await getUserDisplay(conn, adminUserID);
  // 1) ensure workday
  await conn.execute(
    "INSERT INTO workday (workDate) VALUES (?) ON DUPLICATE KEY UPDATE workDate = workDate",
    [date]
  );
  // 2) claim the column if free
  const [r1] = await conn.execute(
    `UPDATE workday SET ${col} = ? WHERE workDate = ? AND (${col} IS NULL OR ${col} = '')`,
    [display, date]
  );
  // 3) insert canonical appointment (open so you can cancel it later if needed)
  await conn.execute(
    `INSERT IGNORE INTO appointments (userID, workDate, slot, status, notes)
     VALUES (?, ?, ?, 'open', 'admin hold via myEvents')`,
    [adminUserID, date, toHMS(timeHM)]
  );
  return r1?.affectedRows === 1;
}



// run bootstrap in the background on boot
(async () => {
  try { await initMyEvents(); } catch (e) { console.error("[initMyEvents]", e?.sqlMessage || e); }
})();

/** Cancel the admin-hold for a specific slot on a date and free workday cell */
async function releaseSlotAdminHold(conn, { date, col }) {
  // map slot column -> "HH:MM"
  const timeHM = await colToTimeHM(conn, col);
  if (!timeHM) return;

  // lock any matching admin-hold appts at that time/date
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
    // mark appointment as canceled (you can DELETE if you prefer)
    await conn.execute(
      `UPDATE appointments SET status='canceled' WHERE id = ?`,
      [ap.id]
    );

    // free the workday column ONLY if the cell still contains our hold value
    const display = await getUserDisplay(conn, ap.userID);
    await conn.execute(
      `UPDATE workday
         SET ${col} = NULL
       WHERE workDate = ?
         AND ${col} = ?`,
      [date, display]
    );
  }
}


/* ------------------------------ Load Times (per-id cache) ------------------------------ */
const TIMES_CACHE_TTL = 30_000; // 30s
const _timesCacheById = new Map(); // id -> {at:number, data:{arr,map,toHMS}}

function _normalizeHM(v) {
  const s = String(v ?? "").trim();
  // accept HH:MM or HH:MM:SS and return HH:MM
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return s;
}
function _toHMS(v) {
  const s = String(v ?? "").trim();
  return s.length === 5 ? `${s}:00` : s; // HH:MM -> HH:MM:SS
}

/** dynamic slot times loader (cache per id) */
async function loadTimes(connOrPool = pool, id = 1) {
  const now = Date.now();
  const cached = _timesCacheById.get(id);
  if (cached && now - cached.at < TIMES_CACHE_TTL) return cached.data;

  const [rows] = await connOrPool.query(
    `SELECT firstApp, secondApp, thirdApp, fourthApp, fifthApp
     FROM timesOfAppointments WHERE id = ?`,
    [id]
  );
  if (!rows.length) throw new Error(`timesOfAppointments row missing for id=${id}`);

  const r = rows[0];
  const arr = [
    _normalizeHM(r.firstApp),
    _normalizeHM(r.secondApp),
    _normalizeHM(r.thirdApp),
    _normalizeHM(r.fourthApp),
    _normalizeHM(r.fifthApp),
  ];
  const cols = ["firstApp","secondApp","thirdApp","fourthApp","fifthApp"];
  const map = new Map();            // "HH:MM" -> workday column
  arr.forEach((t, i) => map.set(t, cols[i]));

  const data = { arr, map, toHMS: _toHMS };
  _timesCacheById.set(id, { at: now, data });
  return data;
}


// Replace your /api/health with this
app.get("/api/health", async (_req, res) => {
  try {
    const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");
    const [[u]]     = await pool.query("SELECT COUNT(*) AS n FROM users");
    const [[a]]     = await pool.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()");
    res.json({ ok: true, db: dbRow?.db || null, users_count: Number(u?.n||0), tables_count: Number(a?.n||0) });
  } catch (e) {
    console.error("[health]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "db" });
  }
});


/* --------------------------------- Signup --------------------------------- */
app.post("/api/signup", async (req, res) => {
  try {
    const {
      userID,
      firstName,
      lastName,
      userName,
      dateOfBirth,
      phoneNumber,
      password,
    } = req.body || {};

    if (!userID || isNaN(Number(userID))) {
      return res
        .status(400)
        .json({ error: "User ID is required and must be numeric" });
    }
    if (!firstName?.trim() || !lastName?.trim() || !userName?.trim() || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (String(userName).trim().length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(password, +process.env.BCRYPT_ROUNDS || 12);

    const sql = `
      INSERT INTO users (userID, firstName, lastName, userName, dateOfBirth, phoneNumber, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      Number(userID),
      firstName.trim(),
      lastName.trim(),
      userName.trim(),
      dateOfBirth || null,
      phoneNumber || null,
      hash,
    ];

    await pool.execute(sql, params);
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") {
      const msg = String(e.message || "").toLowerCase();
      if (msg.includes("primary")) return res.status(409).json({ error: "That userID is already in use" });
      if (msg.includes("username")) return res.status(409).json({ error: "That username is already in use" });
      if (msg.includes("phone")) return res.status(409).json({ error: "That phone is already in use" });
      return res.status(409).json({ error: "That value is already in use" });
    }
    console.error("[signup]", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------- Login --------------------------------- */
app.post("/api/login", async (req, res) => {
  try {
    const { userNameOrPhone, password } = req.body || {};
    const ident = String(userNameOrPhone || "").trim();
    const pwd = String(password || "");
    if (!ident || !pwd) return res.status(400).json({ error: "Missing credentials" });

    const sql = `
      SELECT userID, userName, phoneNumber, password_hash, role
      FROM users
      WHERE userName = ? OR phoneNumber = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(sql, [ident, ident]);
    const user = rows?.[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(pwd, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ ok: true, user: { userID: user.userID, userName: user.userName, role: user.role || "user" } });
  } catch (e) {
    console.error("[login]", e);
    res.status(500).json({ error: "Server error" });
  }
});

/* ----------------------------- Availability ------------------------------- */
// GET /api/availability?date=YYYY-MM-DD
app.get("/api/availability", async (req, res) => {
  try {
    const { date } = req.query;
    if (!isISODate(date)) return res.status(400).json({ ok: false, error: "Missing or bad date" });

    const { arr } = await loadTimes(); // ["HH:MM", ...]
    const [rows] = await pool.execute(
      "SELECT firstApp, secondApp, thirdApp, fourthApp, fifthApp FROM workday WHERE workDate = ? LIMIT 1",
      [date]
    );

    const taken = new Set();
    if (rows.length) {
      const r = rows[0];
      if (r.firstApp?.trim())  taken.add(arr[0]);
      if (r.secondApp?.trim()) taken.add(arr[1]);
      if (r.thirdApp?.trim())  taken.add(arr[2]);
      if (r.fourthApp?.trim()) taken.add(arr[3]);
      if (r.fifthApp?.trim())  taken.add(arr[4]);
    }

    // ALSO: treat any disabled flags in myEvents as taken
    const [[ev]] = await pool.query(
      "SELECT firstApp,secondApp,thirdApp,fourthApp,fifthApp FROM myEvents WHERE workDate=?",
      [date]
    );
    if (ev) {
      if (!ev.firstApp)  taken.add(arr[0]);
      if (!ev.secondApp) taken.add(arr[1]);
      if (!ev.thirdApp)  taken.add(arr[2]);
      if (!ev.fourthApp) taken.add(arr[3]);
      if (!ev.fifthApp)  taken.add(arr[4]);
    }

    const available = arr.filter((t) => !taken.has(t));
    res.json({ ok: true, available });
  } catch (e) {
    console.error("[availability]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});



/* ------------------------------- Create Appt ------------------------------ */
/**
 * POST /api/appointments
 * Body: { userID, userName?, date:'YYYY-MM-DD', time:'HH:mm', location? -> stored in notes }
 * Behavior:
 *  - ensures a row in `workday`
 *  - atomically fills the slot col if empty
 *  - inserts into `appointments` (status='open')
 */
// POST /api/appointments  { userID, date:'YYYY-MM-DD', time:'HH:MM', location? }
app.post("/api/appointments", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { userID, date, time, location } = req.body || {};
    if (!userID || !isISODate(date) || !isHMTime(time)) {
      conn.release();
      return res.status(400).json({ ok: false, error: "Missing or bad fields" });
    }

    const role = await getUserRole(conn, Number(userID));
    const { map } = await loadTimes(conn);
    const hhmm = String(time).slice(0,5);
    if (!map.has(hhmm)) { conn.release(); return res.status(400).json({ ok: false, error: "Invalid time" }); }

    // If there is a myEvents row and the mapped flag is FALSE -> block non-managers
    const col = map.get(hhmm); // e.g. 'firstApp'
    const [[ev]] = await conn.query(
      `SELECT ${col} AS allowed FROM myEvents WHERE workDate=?`,
      [date]
    );
    if (ev && !ev.allowed && role !== "manager") {
      conn.release();
      return res.status(403).json({ ok: false, error: "This slot is closed by admin" });
    }

    // Proceed with atomic booking
    await bookAppointmentTx(conn, {
      userID: Number(userID),
      date,
      time: hhmm,
      notes: location || null,
    });

    res.status(201).json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("[appointments]", e);

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



/* ------------------------------ My Appointments --------------------------- */
/**
 * GET /api/my/appointments?userID=123&status=open|closed|canceled|all
 */
app.get("/api/my/appointments", async (req, res) => {
  try {
    const { userID, status = "open" } = req.query;
    if (!userID) return res.status(400).json({ ok: false, error: "Missing userID" });

    const params = [userID];
    let whereStatus = "";
    if (status !== "all") {
      whereStatus = " AND status = ? ";
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT id, workDate, slot, status, notes, created_at, updated_at
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

/* ------------------------------ Update Status ----------------------------- */
/**
 * PATCH /api/appointments/:id  { status: "open" | "closed" | "canceled" }
 * If canceling: also free the column in workday.
 * Uses transaction + row lock to avoid races.
 */
// PATCH /api/appointments/:id   { status: 'open'|'closed'|'canceled', paidAmount? }
app.patch("/api/appointments/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { status, paidAmount } = req.body || {};
    if (!["open","closed","canceled"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Invalid status" });
    }

    await conn.beginTransaction();

    const [[appt]] = await conn.query(
      "SELECT id, status, workDate, TIME_FORMAT(slot,'%H:%i') AS slotHM FROM appointments WHERE id = ? FOR UPDATE",
      [id]
    );
    if (!appt) { await conn.rollback(); return res.status(404).json({ ok: false, error: "Not found" }); }

    if (appt.status === "closed" && status === "canceled") {
      await conn.rollback();
      return res.status(409).json({ ok: false, error: "Cannot cancel a closed appointment" });
    }

    if (status === "closed") {
      const amtNum = Number(paidAmount);
      if (!Number.isFinite(amtNum) || amtNum < 0 || amtNum > 1e9) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: "Invalid paidAmount" });
      }
      await conn.execute("UPDATE appointments SET status='closed', paid_amount=? WHERE id=?", [amtNum, id]);
    } else if (status === "open") {
      await conn.execute("UPDATE appointments SET status='open' WHERE id=?", [id]);
    } else {
      // canceled: free the mapped column for that slot
      const { map } = await loadTimes(conn);
      const col = map.get(appt.slotHM);
      await conn.execute("UPDATE appointments SET status='canceled' WHERE id=?", [id]);
      if (col) {
        await conn.execute(`UPDATE workday SET ${col} = NULL WHERE workDate = ?`, [appt.workDate]);
      }
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error("[update appt status]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});



/* --------------------------------- Admin ---------------------------------- */
// GET /api/admin/schedule?date=YYYY-MM-DD
// schedule (simple)
app.get("/api/admin/schedule", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ ok: false, error: "Missing date" });

    const [rows] = await pool.execute(
      `
      SELECT
        a.id, a.workDate,
        TIME_FORMAT(a.slot,'%H:%i') AS slot,
        a.status, a.notes, a.paid_amount,
        u.userID, u.userName, u.firstName, u.lastName, u.phoneNumber
      FROM appointments a
      JOIN users u ON u.userID = a.userID
      WHERE a.workDate = ?
      ORDER BY a.slot ASC
      `,
      [date]
    );
    res.json({ ok: true, schedule: rows });
  } catch (e) {
    console.error("[admin schedule]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});


// GET /api/admin/workdays?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/api/admin/workdays", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ ok: false, error: "Missing from/to" });

    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(from) || !re.test(to)) return res.status(400).json({ ok: false, error: "Bad date format" });

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
    console.error("[admin workdays]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ------------------------------- Start server ----------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${PORT}`);
});

// GET /api/admin/schedule2?date=YYYY-MM-DD
app.get("/api/admin/schedule2", async (req, res) => {
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
        a.paid_amount,
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
      const amt = r.paid_amount != null ? Number(r.paid_amount) : null;
      if (statusUi === "done" && amt != null) totalPaid += amt;

      schedule.push({
        id: r.id,
        workDate: date,
        slot: (r.slot || "").slice(0, 5), // "HH:MM"
        status: statusUi,
        paidAmount: amt,
        notes: r.notes ?? null,
        userID: r.userID,
        userName: r.userName || "",
        firstName: r.firstName || "",
        lastName: r.lastName || "",
        phoneNumber: r.phoneNumber || "",
      });
    }

    // already ordered by time in SQL
    return res.json({ ok: true, schedule, totalPaid });
  } catch (e) {
    console.error("[admin schedule2]", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});




// GET /api/times  -> { ok:true, times:["HH:MM", ...] }
app.get("/api/times", async (_req, res) => {
  try {
    const { arr } = await loadTimes();
    res.json({ ok: true, times: arr });
  } catch (e) {
    console.error("[/api/times]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.post("/api/admin/times/refresh", (_req, res) => {
  try { _timesCache = null; _timesAt = 0; res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: "refresh failed" }); }
});


// GET /api/admin/reports/monthly?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get("/api/admin/reports/monthly", async (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const today = new Date();
    const defaultTo   = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
    const defaultFrom = new Date(today.getFullYear(), today.getMonth()-11, 1).toISOString().slice(0,10);

    const from = re.test(String(req.query.from||"")) ? req.query.from : defaultFrom;
    const to   = re.test(String(req.query.to||""))   ? req.query.to   : defaultTo;

    const [rows] = await pool.query(
      `
      SELECT
        DATE_FORMAT(workDate, '%Y-%m') AS ym,
        YEAR(workDate)  AS y,
        MONTH(workDate) AS m,
        COUNT(*) AS appts,
        COALESCE(SUM(CASE WHEN status='closed' THEN paid_amount ELSE 0 END), 0) AS revenue
      FROM appointments
      WHERE workDate >= ?
        AND workDate < DATE_ADD(?, INTERVAL 1 MONTH)
      GROUP BY ym, y, m
      ORDER BY y ASC, m ASC
      `,
      [from, to]
    );

    res.json({
      ok: true,
      from, to,
      months: rows.map(r => ({
        ym: String(r.ym),
        year: Number(r.y),
        month: Number(r.m),
        appts: Number(r.appts || 0),
        revenue: Number(r.revenue || 0)
      }))
    });
  } catch (e) {
    console.error("[reports/monthly]", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* --------------------------------- Admin: Users --------------------------- */
/* ------------------------------ Admin Helpers ----------------------------- */
function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}
function isHMTime(s) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
}

/** get display string for workday cell (prefer username, fallback userID) */
async function getUserDisplay(conn, userID) {
  const [[u]] = await conn.query(
    "SELECT userName FROM users WHERE userID = ?",
    [userID]
  );
  if (u?.userName && String(u.userName).trim()) return String(u.userName).trim();
  return String(userID);
}

/**
 * Atomically book a slot for a user (admin/manual).
 * - ensures workday row
 * - fills the right column if empty
 * - inserts canonical appointments row
 */
async function bookAppointmentTx(conn, { userID, date, time, notes }) {
  const { map, toHMS } = await loadTimes(conn);
  const hhmm = String(time).slice(0, 5);
  if (!map.has(hhmm)) throw Object.assign(new Error("Invalid time"), { code: "BAD_TIME" });

  const col = map.get(hhmm);
  const display = await getUserDisplay(conn, userID);

  await conn.beginTransaction();

  // ensure workday
  await conn.execute(
    "INSERT INTO workday (workDate) VALUES (?) ON DUPLICATE KEY UPDATE workDate = workDate",
    [date]
  );

  // claim the slot iff empty
  const [updateRes] = await conn.execute(
    `UPDATE workday
       SET ${col} = ?
     WHERE workDate = ?
       AND ( ${col} IS NULL OR ${col} = '' )`,
    [display, date]
  );
  if (updateRes.affectedRows !== 1) {
    await conn.rollback();
    const err = new Error("That time is already booked");
    err.code = "CONFLICT";
    throw err;
  }

  // canonical row
  await conn.execute(
    `INSERT INTO appointments (userID, workDate, slot, status, notes)
     VALUES (?, ?, ?, 'open', ?)`,
    [userID, date, toHMS(hhmm), notes || null]
  );

  await conn.commit();
}


/* -------------------------------- Admin: Users (diagnostic & bulletproof) ------------------------------- */
// --- replace the whole /api/admin/users route with this ---
const DEV = process.env.NODE_ENV !== "production";

// GET /api/admin/users  -> users + { closedCount, revenue } (no passwords)
app.get("/api/admin/users", async (_req, res) => {
  const conn = await pool.getConnection();
  try {
    // base users (defensive: SELECT * then strip password-ish fields)
    const [[countRow]] = await conn.query(`SELECT COUNT(*) AS n FROM users`);
    const usersCount = Number(countRow?.n || 0);

    const [rows] = await conn.query(`SELECT * FROM users`);
    const users = rows.map((r) => {
      const {
        password, password_hash, passwd, pass, pwd, hash,
        ...safe
      } = r;
      return safe;
    });

    // stats per user: closed appointments + sum of paid_amount for closed
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

    // merge stats into users
    for (const u of users) {
      const s = statsMap.get(Number(u.userID)) || { closedCount: 0, revenue: 0 };
      u.closedCount = s.closedCount;
      u.revenue = s.revenue;
    }

    // sort: userNumber -> userID (as you had)
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
    const msg = e?.sqlMessage || e?.message || "Server error";
    console.error("[/api/admin/users]", msg);
    return res.status(500).json({
      ok: false,
      error: DEV ? msg : "Server error",
    });
  } finally {
    conn.release();
  }
});

// POST /api/admin/users/:userId/appointments
// Body: { date: 'YYYY-MM-DD', time: 'HH:MM', notes?: string }
app.post("/api/admin/users/:userId/appointments", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userID = Number(req.params.userId);
    const { date, time, notes } = req.body || {};

    if (!Number.isFinite(userID)) {
      return res.status(400).json({ ok: false, error: "Bad userId" });
    }
    if (!isISODate(date) || !isHMTime(time)) {
      return res.status(400).json({ ok: false, error: "Bad date or time" });
    }

    await bookAppointmentTx(conn, {
      userID,
      date,
      time,
      notes: notes || null,
    });

    return res.status(201).json({ ok: true });
  } catch (e) {
    // normalize common errors
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
    return res.status(status).json({ ok: false, error: msg });
  } finally {
    conn.release();
  }
});

/* ======================= PRODUCTS (use existing `product` table) ======================= */
/*
  Table `product` (yours):
  - productName (PK, VARCHAR)
  - categoryName (FK -> categories.categoryName)
  - barcode (UNIQUE, nullable)
  - qnt INT DEFAULT 0
  - firma VARCHAR(100)
  - lastItemOpened DATE
  - color VARCHAR(100)
*/

/** List/search consumables
 * GET /api/products?search=&category=&zeroOnly=true
 */
app.get("/api/products", async (req, res) => {
  try {
    const { search = "", category = "", zeroOnly } = req.query;

    const where = [];
    const params = [];

    if (search.trim()) {
      const like = `%${String(search).trim()}%`;
      where.push("(productName LIKE ? OR barcode LIKE ? OR color LIKE ? OR firma LIKE ?)");
      params.push(like, like, like, like);
    }
    if (category.trim()) {
      where.push("categoryName = ?");
      params.push(String(category).trim());
    }
    if (String(zeroOnly).toLowerCase() === "true") {
      where.push("qnt = 0");
    }

    const sql = `
      SELECT productName, categoryName, barcode, qnt, firma, color, lastItemOpened
      FROM product
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY productName ASC
    `;
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("[GET /api/products]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** Create product (no prices; consumables only)
 * POST /api/products
 * body: { productName, categoryName, barcode?, color?, firma?, qnt? }
 */
app.post("/api/products", async (req, res) => {
  try {
    const { productName, categoryName, barcode, color, firma, qnt = 0 } = req.body || {};
    if (!productName?.trim() || !categoryName?.trim()) {
      return res.status(400).json({ ok: false, error: "productName and categoryName are required" });
    }
    const q = Number(qnt);
    if (!Number.isInteger(q) || q < 0) {
      return res.status(400).json({ ok: false, error: "qnt must be a non-negative integer" });
    }

    const sql = `
      INSERT INTO product (productName, categoryName, barcode, qnt, firma, lastItemOpened, color)
      VALUES (?, ?, ?, ?, ?, NULL, ?)
    `;
    await pool.execute(sql, [
      productName.trim(),
      categoryName.trim(),
      barcode?.trim() || null,
      q,
      firma?.trim() || null,
      color?.trim() || null,
    ]);

    res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, error: "Duplicate (productName or barcode)" });
    }
    console.error("[POST /api/products]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** Update metadata (NOT quantity)
 * PATCH /api/products/:name
 * body: { productName?, categoryName?, barcode?, color?, firma? }
 * Note: primary key is productName; path param is the current name.
 */
app.patch("/api/products/:name", async (req, res) => {
  try {
    const keyName = decodeURIComponent(req.params.name);
    const allowed = ["productName", "categoryName", "barcode", "color", "firma"];
    const sets = [];
    const params = [];

    for (const k of allowed) {
      if (k in req.body) {
        sets.push(`${k} = ?`);
        const v = req.body[k];
        params.push(v === "" ? null : String(v));
      }
    }
    if (!sets.length) return res.status(400).json({ ok: false, error: "Nothing to update" });

    params.push(keyName);
    const [r] = await pool.execute(
      `UPDATE product SET ${sets.join(", ")} WHERE productName = ?`,
      params
    );
    if (r.affectedRows !== 1) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, error: "Duplicate (productName or barcode)" });
    }
    console.error("[PATCH /api/products/:name]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** Delete product
 * DELETE /api/products/:name
 */
app.delete("/api/products/:name", async (req, res) => {
  try {
    const keyName = decodeURIComponent(req.params.name);
    const [r] = await pool.execute("DELETE FROM product WHERE productName = ?", [keyName]);
    if (r.affectedRows !== 1) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/products/:name]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** Adjust quantity atomically (+ add / − remove)
 * POST /api/products/:name/adjust
 * body: { delta: +int | -int }
 */
app.post("/api/products/:name/adjust", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const keyName = decodeURIComponent(req.params.name);
    const delta = Number(req.body?.delta);
    if (!Number.isInteger(delta) || delta === 0) {
      conn.release();
      return res.status(400).json({ ok: false, error: "delta must be a non-zero integer" });
    }

    await conn.beginTransaction();

    const [[row]] = await conn.query(
      "SELECT productName, qnt FROM product WHERE productName = ? FOR UPDATE",
      [keyName]
    );
    if (!row) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const newQ = Number(row.qnt) + delta;
    if (newQ < 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ ok: false, error: "Quantity cannot go negative" });
    }

    await conn.execute("UPDATE product SET qnt = ? WHERE productName = ?", [newQ, keyName]);
    await conn.commit();
    res.json({ ok: true, qnt: newQ });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("[POST /api/products/:name/adjust]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

/** (Optional) categories list for a dropdown
 * GET /api/categories
 */
app.get("/api/categories", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT categoryName FROM categories ORDER BY categoryName ASC");
    res.json({ ok: true, categories: rows.map(r => r.categoryName) });
  } catch (e) {
    console.error("[GET /api/categories]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});


// GET /api/categories  (alias)
app.get("/api/categories", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT categoryName FROM categories ORDER BY categoryName ASC"
    );
    res.json({ ok: true, categories: rows.map(r => r.categoryName) });
  } catch (e) {
    console.error("[GET /api/categories]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/categories  (alias)
app.post("/api/categories", async (req, res) => {
  try {
    const { categoryName } = req.body || {};
    if (!categoryName?.trim())
      return res.status(400).json({ ok: false, error: "Name required" });

    await pool.execute(
      "INSERT INTO categories (categoryName) VALUES (?)",
      [categoryName.trim()]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ ok: false, error: "Category exists" });
    console.error("[POST /api/categories]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* 1) NEW: Use-one endpoint (atomic qnt-1 + set lastItemOpened = today)
   POST /api/products/:name/use
*/
app.post("/api/products/:name/use", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const keyName = decodeURIComponent(req.params.name);

    await conn.beginTransaction();
    // lock the row
    const [[row]] = await conn.query(
      "SELECT productName, qnt FROM product WHERE productName = ? FOR UPDATE",
      [keyName]
    );
    if (!row) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ ok: false, error: "Not found" });
    }
    if (Number(row.qnt) <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ ok: false, error: "Out of stock" });
    }

    // decrement and set lastItemOpened = CURDATE()
    await conn.execute(
      "UPDATE product SET qnt = qnt - 1, lastItemOpened = CURDATE() WHERE productName = ?",
      [keyName]
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("[POST /api/products/:name/use]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

/* 2) TWEAK: support lowOnly (qnt = 1) and format lastItemOpened as YYYY-MM-DD
   Update your existing GET /api/products handler query construction like this:
*/
app.get("/api/products", async (req, res) => {
  try {
    const { search = "", category = "", zeroOnly, lowOnly } = req.query;

    const where = [];
    const params = [];

    if (search.trim()) {
      const like = `%${String(search).trim()}%`;
      where.push("(productName LIKE ? OR barcode LIKE ? OR color LIKE ? OR firma LIKE ?)");
      params.push(like, like, like, like);
    }
    if (category.trim()) {
      where.push("categoryName = ?");
      params.push(String(category).trim());
    }

    const wantZero = String(zeroOnly).toLowerCase() === "true";
    const wantLow  = String(lowOnly).toLowerCase() === "true";
    if (wantZero && wantLow) {
      where.push("qnt IN (0,1)");
    } else if (wantZero) {
      where.push("qnt = 0");
    } else if (wantLow) {
      where.push("qnt = 1");
    }

    const sql = `
      SELECT
        productName,
        categoryName,
        barcode,
        qnt,
        firma,
        color,
        DATE_FORMAT(lastItemOpened, '%Y-%m-%d') AS lastItemOpened
      FROM product
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY productName ASC
    `;
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, items: rows });
  } catch (e) {
    console.error("[GET /api/products]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// DELETE /api/categories/:name
app.delete("/api/categories/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const [r] = await pool.execute(
      "DELETE FROM categories WHERE categoryName = ?",
      [name]
    );
    if (r.affectedRows !== 1) {
      return res.status(404).json({ ok: false, error: "Not found" });
    }
    res.json({ ok: true });
  } catch (e) {
    // If the category is referenced by products, MySQL will block deletion
    // with a foreign-key error (ER_ROW_IS_REFERENCED_* = 1451).
    if (e?.code === "ER_ROW_IS_REFERENCED_2" || e?.errno === 1451) {
      return res
        .status(409)
        .json({ ok: false, error: "Category has products; move/delete them first" });
    }
    console.error("[DELETE /api/categories/:name]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ========================= END PRODUCTS (existing schema) ========================= */


// GET /api/times?id=1  -> { ok:true, times:["HH:MM", ...] }
app.get("/api/times", async (req, res) => {
  try {
    const id = Number(req.query.id) || 1;
    const { arr } = await loadTimes(pool, id);
    res.json({ ok: true, times: arr, id });
  } catch (e) {
    console.error("[GET /api/times]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// GET /api/times?id=1  -> { ok:true, times:["HH:MM", ...], id }
app.get("/api/times", async (req, res) => {
  try {
    const id = Number(req.query.id) || 1;
    const { arr } = await loadTimes(pool, id);
    res.json({ ok: true, times: arr, id });
  } catch (e) {
    console.error("[GET /api/times]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// PATCH /api/times?id=1  (manager only)
// body: { firstApp: "HH:MM(:SS)", ..., fifthApp: "HH:MM(:SS)" }
app.patch("/api/times", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const id = Number(req.query.id) || 1;

    // auth: require manager via x-user-id
    const callerID = Number(req.get("x-user-id") || 0);
    const role = await getUserRole(conn, callerID);
    if (role !== "manager") {
      return res.status(403).json({ ok: false, error: "Managers only" });
    }

    const keys = ["firstApp", "secondApp", "thirdApp", "fourthApp", "fifthApp"];
    const raw = keys.map((k) => String(req.body?.[k] ?? "").trim());

    if (raw.some((s) => !/^\d{2}:\d{2}(:\d{2})?$/.test(s))) {
      return res.status(400).json({ ok: false, error: "Times must be HH:MM or HH:MM:SS" });
    }

    // distinct HH:MM
    const hmSet = new Set(raw.map((s) => s.slice(0, 5)));
    if (hmSet.size !== 5) {
      return res.status(400).json({ ok: false, error: "Times must be distinct" });
    }

    const asHMS = raw.map(_toHMS);

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

    // clear cache for this id
    _timesCacheById.delete(id);

    const { arr } = await loadTimes(conn, id);
    res.json({ ok: true, id, times: arr });
  } catch (e) {
    console.error("[PATCH /api/times]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  } finally {
    conn.release();
  }
});

// POST /api/admin/times/refresh?id=1  -> clears cache (all if id omitted)
app.post("/api/admin/times/refresh", (req, res) => {
  try {
    const id = req.query.id ? Number(req.query.id) : null;
    if (id && _timesCacheById.has(id)) _timesCacheById.delete(id);
    else if (!id) _timesCacheById.clear();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "refresh failed" });
  }
});

/* ======================= /api/my-events (GET & PATCH) ======================= */

// GET /api/my-events/:date  -> current flags (defaults TRUE if no row)
app.get("/api/my-events/:date", async (req, res) => {
  try {
    const date = String(req.params.date || "");
    if (!isISODate(date)) {
      return res.status(400).json({ ok: false, error: "Bad date" });
    }
    const row = await getMyEventRow(pool, date); // inserts defaults if missing
    return res.json({ ok: true, event: row });
  } catch (e) {
    console.error("[GET my-events/:date]", e?.sqlMessage || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// PATCH /api/my-events/:date
// Body: either explicit booleans { firstApp?, secondApp?... }
// Or "only one": { only: "firstApp" | "secondApp" | ... }
app.patch("/api/my-events/:date", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const date = String(req.params.date || "");
    if (!isISODate(date)) {
      return res.status(400).json({ ok: false, error: "Bad date" });
    }

    // must be manager (x-user-id required)
    const callerID = Number(req.get("x-user-id") || 0);
    const role = await getUserRole(conn, callerID);
    if (role !== "manager") {
      return res.status(403).json({ ok: false, error: "Managers only" });
    }

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

    // resolve unspecified to previous; coerce to boolean
    for (const c of SLOT_COLS) {
      nextFlags[c] = nextFlags[c] === undefined ? !!prev[c] : !!nextFlags[c];
    }

    // upsert flags
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

    // apply holds/releases
    for (const col of SLOT_COLS) {
      const was = !!prev[col];
      const now = !!nextFlags[col];
      if (was && !now) {
        // closing -> create admin hold
        await holdSlotForAdmin(conn, { adminUserID: callerID, date, col });
      } else if (!was && now) {
        // re-opening -> release admin hold
        await releaseSlotAdminHold(conn, { date, col });
      }
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


