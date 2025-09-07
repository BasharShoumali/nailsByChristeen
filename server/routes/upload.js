// server/routes/uploads.js
import { Router } from "express";
import multer from "multer";

const r = Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp|gif)/i.test(file.mimetype);
    cb(ok ? null : new Error("INVALID_TYPE"), ok);
  },
});

r.get("/uploads/ping", (_req, res) =>
  res.json({ ok: true, where: "/api/uploads/ping" })
);

r.post("/uploads", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ ok: false, error: "File too large (max 5MB)" });
      if (err.message === "INVALID_TYPE")
        return res.status(400).json({ ok: false, error: "Only PNG, JPG, WebP, GIF allowed" });
      return res.status(400).json({ ok: false, error: "Upload failed" });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: "No file" });

    const origin = `${req.protocol}://${req.get("host")}`;
    const url = `${origin}/uploads/${req.file.filename}`;
    res.json({ ok: true, url });
  });
});

export default r; // ✅ default export
