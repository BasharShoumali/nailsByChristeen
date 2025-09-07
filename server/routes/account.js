// server/routes/account.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../db/pool.js";

const r = Router();
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

/** (Optional) normalize IL phone for storage or leave as-is.
 *  Here we store as the user typed, but require at least 9 digits.
 */
function isValidPhone(p) {
  return onlyDigits(p).length >= 9;
}

/** POST /api/account/update-phone
 * Body: { userID, password, newPhone }
 */
r.post("/account/update-phone", async (req, res) => {
  try {
    const { userID, password, newPhone } = req.body || {};
    const idNum = Number(userID);
    if (!Number.isFinite(idNum)) return res.status(400).json({ ok:false, error:"Invalid userID" });
    if (!password) return res.status(400).json({ ok:false, error:"Password is required" });
    if (!newPhone || !isValidPhone(newPhone)) return res.status(400).json({ ok:false, error:"Invalid phone number" });

    const [rows] = await pool.execute(
      `SELECT userID, password_hash FROM users WHERE userID = ? LIMIT 1`,
      [idNum]
    );
    const u = rows?.[0];
    if (!u) return res.status(404).json({ ok:false, error:"User not found" });

    const ok = await bcrypt.compare(String(password), u.password_hash);
    if (!ok) return res.status(401).json({ ok:false, error:"Invalid password" });

    await pool.execute(
      `UPDATE users SET phoneNumber = ? WHERE userID = ?`,
      [String(newPhone).trim(), idNum]
    );
    return res.json({ ok:true, updated:true });
  } catch (e) {
    console.error("[update-phone]", e?.sqlMessage || e);
    return res.status(500).json({ ok:false, error:"Server error" });
  }
});

/** POST /api/account/update-password
 * Body: { userID, currentPassword, newPassword }
 */
r.post("/account/update-password", async (req, res) => {
  try {
    const { userID, currentPassword, newPassword } = req.body || {};
    const idNum = Number(userID);
    if (!Number.isFinite(idNum)) return res.status(400).json({ ok:false, error:"Invalid userID" });
    if (!currentPassword) return res.status(400).json({ ok:false, error:"Current password is required" });
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ ok:false, error:"New password must be at least 6 characters" });
    }

    const [rows] = await pool.execute(
      `SELECT userID, password_hash FROM users WHERE userID = ? LIMIT 1`,
      [idNum]
    );
    const u = rows?.[0];
    if (!u) return res.status(404).json({ ok:false, error:"User not found" });

    const ok = await bcrypt.compare(String(currentPassword), u.password_hash);
    if (!ok) return res.status(401).json({ ok:false, error:"Invalid current password" });

    const hash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
    await pool.execute(`UPDATE users SET password_hash = ? WHERE userID = ?`, [hash, idNum]);

    return res.json({ ok:true, updated:true });
  } catch (e) {
    console.error("[update-password]", e?.sqlMessage || e);
    return res.status(500).json({ ok:false, error:"Server error" });
  }
});

export default r;
