// server/routes/diag.js
import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

// GET /api/_diag/snapshot  -> first rows + counts for key tables
r.get("/_diag/snapshot", async (_req, res) => {
  try {
    const [[db]] = await pool.query("SELECT DATABASE() AS db");
    const tables = ["users","appointments","workday","timesOfAppointments","product","categories"];

    // counts
    const counts = {};
    for (const t of tables) {
      try {
        const [[c]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
        counts[t] = Number(c.n || 0);
      } catch (e) {
        counts[t] = `ERR: ${e.code || e.message}`;
      }
    }

    // first rows
    async function firstRows(table, cols="*") {
      try {
        const [rows] = await pool.query(`SELECT ${cols} FROM \`${table}\` LIMIT 5`);
        return rows;
      } catch (e) {
        return { error: e.code || e.sqlMessage || e.message };
      }
    }

    const sample = {
      users: await firstRows("users", "userID, userName, phoneNumber, role"),
      appointments: await firstRows("appointments", "id, userID, workDate, slot, status, paid_amount"),
      workday: await firstRows("workday", "workDate, firstApp, secondApp, thirdApp, fourthApp, fifthApp"),
      timesOfAppointments: await firstRows("timesOfAppointments", "id, firstApp, secondApp, thirdApp, fourthApp, fifthApp"),
      product: await firstRows("product", "productName, categoryName, barcode, qnt, color, firma, lastItemOpened"),
      categories: await firstRows("categories", "categoryName"),
    };

    res.json({ ok: true, db: db.db, counts, sample });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.sqlMessage || e.message });
  }
});

// GET /api/_diag/query?sql=SELECT%201  (careful: read-only)
r.get("/_diag/query", async (req, res) => {
  try {
    const sql = String(req.query.sql || "");
    // rudimentary guard: only allow SELECT/SHOW/DESC to avoid mutations
    if (!/^\s*(SELECT|SHOW|DESCRIBE|DESC)\b/i.test(sql)) {
      return res.status(400).json({ ok: false, error: "Only SELECT/SHOW/DESCRIBE allowed" });
    }
    const [rows] = await pool.query(sql);
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.sqlMessage || e.message });
  }
});

export default r;
