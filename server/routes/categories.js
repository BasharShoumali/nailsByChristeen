import { Router } from "express";
import { pool } from "../db/pool.js";

const r = Router();

// GET /api/categories
r.get("/categories", async (_req, res) => {
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

// POST /api/categories
r.post("/categories", async (req, res) => {
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

// DELETE /api/categories/:name
r.delete("/categories/:name", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const [r1] = await pool.execute("DELETE FROM categories WHERE categoryName = ?", [name]);
    if (r1.affectedRows !== 1)
      return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    if (e?.code === "ER_ROW_IS_REFERENCED_2" || e?.errno === 1451) {
      return res.status(409).json({ ok: false, error: "Category has products; move/delete them first" });
    }
    console.error("[DELETE /api/categories/:name]", e?.sqlMessage || e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default r;
