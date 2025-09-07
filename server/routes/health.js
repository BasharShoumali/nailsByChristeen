import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

r.get("/health", async (_req, res) => {
  try {
    const [[dbRow]] = await pool.query("SELECT DATABASE() AS db");
    const [[u]]     = await pool.query("SELECT COUNT(*) AS n FROM users");
    const [[a]]     = await pool.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    res.json({
      ok: true,
      db: dbRow?.db || null,
      users_count: Number(u?.n || 0),
      tables_count: Number(a?.n || 0),
    });
  } catch (e) {
    console.error("[health]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "db" });
  }
});

export default r;
