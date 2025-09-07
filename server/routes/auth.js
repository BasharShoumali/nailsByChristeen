// server/routes/auth.js
import { Router } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { pool } from "../db/pool.js";

const r = Router();

/* ---------------------------------- Helpers ---------------------------------- */
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

function reqStr(v) {
  return String(v ?? "").trim();
}

/* ---------------------------------- Signup ----------------------------------- */
/**
 * POST /api/signup
 * Body: { userID, firstName, lastName, userName, dateOfBirth?, phoneNumber?, password }
 */
r.post("/signup", async (req, res) => {
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

    const idNum = Number(userID);
    if (!Number.isFinite(idNum)) {
      return res.status(400).json({ error: "User ID is required and must be numeric" });
    }

    const f = reqStr(firstName);
    const l = reqStr(lastName);
    const u = reqStr(userName);
    const p = String(password ?? "");

    if (!f || !l || !u || !p) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (u.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    if (p.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(p, BCRYPT_ROUNDS);

    await pool.execute(
      `INSERT INTO users (userID, firstName, lastName, userName, dateOfBirth, phoneNumber, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        idNum,
        f,
        l,
        u,
        dateOfBirth || null,
        reqStr(phoneNumber) || null,
        hash,
      ]
    );

    return res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY") {
      const msg = String(e.message || "").toLowerCase();
      if (msg.includes("primary"))   return res.status(409).json({ error: "That userID is already in use" });
      if (msg.includes("username"))  return res.status(409).json({ error: "That username is already in use" });
      if (msg.includes("phone"))     return res.status(409).json({ error: "That phone is already in use" });
      return res.status(409).json({ error: "That value is already in use" });
    }
    console.error("[signup]", e?.sqlMessage || e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ----------------------------------- Login ----------------------------------- */
/**
 * POST /api/login
 * Body: { userNameOrPhone, password }
 * Returns: { ok:true, user:{ userID, userName, role } }
 */
r.post("/login", async (req, res) => {
  try {
    const ident = reqStr(req.body?.userNameOrPhone);
    const pwd   = String(req.body?.password ?? "");
    if (!ident || !pwd) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const [rows] = await pool.execute(
      `SELECT userID, userName, phoneNumber, password_hash, role
         FROM users
        WHERE userName = ? OR phoneNumber = ?
        LIMIT 1`,
      [ident, ident]
    );
    const user = rows?.[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(pwd, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({
      ok: true,
      user: {
        userID: user.userID,
        userName: user.userName,
        role: user.role || "user",
      },
    });
  } catch (e) {
    console.error("[login]", e?.sqlMessage || e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ---------------------------------- Logout ----------------------------------- */
/**
 * Some clients call /api/logout with credentials:'include'.
 * We add per-route CORS that reflects local dev origins and sets
 * Access-Control-Allow-Credentials: true, so the browser accepts the response.
 * If you don't use cookies, this still returns { ok:true } safely.
 */

const logoutCors = cors({
  origin(origin, cb) {
    // allow no-origin tools (curl/Postman) and local dev UIs
    if (!origin) return cb(null, true);
    if (origin === "http://localhost:3000") return cb(null, true);
    if (origin === "http://localhost:5173") return cb(null, true);
    if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return cb(null, true);
    return cb(null, false); // quietly deny others
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-user-id", "Authorization"],
});

// one handler for GET/POST
function handleLogout(req, res) {
  // If you use a cookie named "session", this clears it; otherwise harmless.
  res.clearCookie?.("session", {
    httpOnly: true,
    sameSite: "lax", // use "none" + secure:true for HTTPS cross-site
    secure: false,   // set true in production HTTPS
    path: "/",
  });
  // ensure ACA-Credentials header present alongside per-route CORS reflection
  res.setHeader("Access-Control-Allow-Credentials", "true");
  return res.json({ ok: true });
}

// Preflight + routes
r.options("/logout", logoutCors);
r.post("/logout", logoutCors, handleLogout);
r.get("/logout", logoutCors, handleLogout);

export default r;
