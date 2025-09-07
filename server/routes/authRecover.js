// server/routes/authRecover.js
import { Router } from "express";
import { pool } from "../db/pool.js";
import bcrypt from "bcrypt";

const r = Router();

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;
const RECOVER_DEBUG = String(process.env.RECOVER_DEBUG || "true").toLowerCase() === "true";

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const normName  = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

/** Normalize Israeli numbers for comparison:
 *  - strip non-digits
 *  - drop leading 972 or leading 0
 *  - compare last 9 digits (e.g. 52xxxxxxx)
 */
function normPhoneIL(s) {
  const d = onlyDigits(s);
  if (!d) return "";
  if (d.startsWith("972")) return d.slice(3).replace(/^0+/, "").slice(-9);
  if (d.startsWith("0"))   return d.slice(1).replace(/^0+/, "").slice(-9);
  return d.slice(-9);
}

function makeTempPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Optional probe
r.get("/auth/_probe", (_req, res) => res.json({ ok: true, where: "/api/auth/_probe" }));

// POST /api/auth/recover  (mounted via routes/index.js with r.use("/api", router))
r.post("/auth/recover", async (req, res) => {
  const b = req.body || {};
  const userID   = Number(b.userID);
  const userName = b.userName;
  const fullName = b.fullName;
  const phone    = b.phone ?? b.phoneNumber;
  const dob      = b.dob   ?? b.dateOfBirth;  // "YYYY-MM-DD"

  if (!Number.isFinite(userID)) return res.status(400).json({ ok:false, error:"Missing or invalid userID" });
  if (!phone) return res.status(400).json({ ok:false, error:"Missing phone" });
  if (!dob || !isISODate(dob)) return res.status(400).json({ ok:false, error:"Missing or invalid date of birth" });
  if (!userName && !fullName) return res.status(400).json({ ok:false, error:"Provide username or full name" });

  const conn = await pool.getConnection();
  try {
    // Normalize DOB on DB side to avoid timezone/JS Date weirdness
    const [rows] = await conn.query(
      `SELECT userID, firstName, lastName, userName, phoneNumber,
              DATE_FORMAT(dateOfBirth, '%Y-%m-%d') AS dob_iso
         FROM users
        WHERE userID = ?
        LIMIT 1`,
      [userID]
    );
    if (!rows?.length) {
      return res.status(404).json({ ok:false, error:"User not found", ...(RECOVER_DEBUG && { errorCode:"NOT_FOUND" }) });
    }

    const u = rows[0];

    const nameOK = userName
      ? normName(u.userName) === normName(userName)
      : `${normName(u.firstName)} ${normName(u.lastName)}` === normName(fullName);

    const phoneOK = normPhoneIL(u.phoneNumber) === normPhoneIL(phone);
    const dobOK   = (u.dob_iso || null) === dob;

    if (!nameOK || !phoneOK || !dobOK) {
      const debug = { nameOK, phoneOK, dobOK, want: { phone: normPhoneIL(phone), dob }, have: { phone: normPhoneIL(u.phoneNumber), dob: u.dob_iso } };
      return res.status(401).json({
        ok: false,
        error: "Details do not match our records",
        ...(RECOVER_DEBUG && { errorCode: !nameOK ? "NAME_MISMATCH" : !phoneOK ? "PHONE_MISMATCH" : "DOB_MISMATCH", _debug: debug })
      });
    }

    const tempPwd = makeTempPassword(10);
    const hash = await bcrypt.hash(tempPwd, BCRYPT_ROUNDS);
    await conn.query(`UPDATE users SET password_hash = ? WHERE userID = ?`, [hash, userID]);

    return res.json({ ok:true, password: tempPwd });
  } catch (e) {
    console.error("[/api/auth/recover]", e?.sqlMessage || e?.message || e);
    return res.status(500).json({ ok:false, error:"Server error" });
  } finally {
    conn.release();
  }
});

export default r;
