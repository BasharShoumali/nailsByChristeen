import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

/** Enhanced GET with lowOnly + formatted date */
r.get("/products", async (req, res) => {
  try {
    const { search = "", category = "", zeroOnly, lowOnly } = req.query;

    const where = [];
    const params = [];

    if (String(search).trim()) {
      const like = `%${String(search).trim()}%`;
      where.push("(productName LIKE ? OR barcode LIKE ? OR color LIKE ? OR firma LIKE ?)");
      params.push(like, like, like, like);
    }
    if (String(category).trim()) {
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
        productName, categoryName, barcode, qnt, firma, color,
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

r.post("/products", async (req, res) => {
  try {
    const { productName, categoryName, barcode, color, firma, qnt = 0 } = req.body || {};
    if (!productName?.trim() || !categoryName?.trim())
      return res.status(400).json({ ok: false, error: "productName and categoryName are required" });

    const q = Number(qnt);
    if (!Number.isInteger(q) || q < 0)
      return res.status(400).json({ ok: false, error: "qnt must be a non-negative integer" });

    await pool.execute(
      `INSERT INTO product (productName, categoryName, barcode, qnt, firma, lastItemOpened, color)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [productName.trim(), categoryName.trim(), barcode?.trim() || null, q, firma?.trim() || null, color?.trim() || null]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ ok: false, error: "Duplicate (productName or barcode)" });
    console.error("[POST /api/products]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

r.patch("/products/:name", async (req, res) => {
  try {
    const keyName = decodeURIComponent(req.params.name);
    const allowed = ["productName", "categoryName", "barcode", "color", "firma"];
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, k)) {
        sets.push(`${k} = ?`);
        const v = req.body[k];
        params.push(v === "" ? null : String(v));
      }
    }
    if (!sets.length) return res.status(400).json({ ok: false, error: "Nothing to update" });

    params.push(keyName);
    const [r1] = await pool.execute(`UPDATE product SET ${sets.join(", ")} WHERE productName = ?`, params);
    if (r1.affectedRows !== 1) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY")
      return res.status(409).json({ ok: false, error: "Duplicate (productName or barcode)" });
    console.error("[PATCH /api/products/:name]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** DELETE /api/products/:name */
r.delete("/products/:name", async (req, res) => {
  try {
    const keyName = decodeURIComponent(req.params.name);
    const [r1] = await pool.execute("DELETE FROM product WHERE productName = ?", [keyName]);
    if (r1.affectedRows !== 1) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/products/:name]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/** POST /api/products/:name/adjust  { delta: +int | -int } */
r.post("/products/:name/adjust", async (req, res) => {
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
      await conn.rollback(); conn.release();
      return res.status(404).json({ ok: false, error: "Not found" });
    }

    const newQ = Number(row.qnt) + delta;
    if (newQ < 0) {
      await conn.rollback(); conn.release();
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

/** POST /api/products/:name/use  (qnt-1 + lastItemOpened=CURDATE()) */
r.post("/products/:name/use", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const keyName = decodeURIComponent(req.params.name);

    await conn.beginTransaction();
    const [[row]] = await conn.query(
      "SELECT productName, qnt FROM product WHERE productName = ? FOR UPDATE",
      [keyName]
    );
    if (!row) { await conn.rollback(); conn.release(); return res.status(404).json({ ok: false, error: "Not found" }); }
    if (Number(row.qnt) <= 0) { await conn.rollback(); conn.release(); return res.status(409).json({ ok: false, error: "Out of stock" }); }

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

export default r;
