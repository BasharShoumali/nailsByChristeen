import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import multer from "multer";

import routes from "./routes/index.js";
import error from "./middleware/error.js";

const app = express();

/* -------- Core middlewares -------- */
app.use(express.json({ limit: "256kb" }));
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: false,
  })
);

/* -------- Static /uploads -------- */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

/* -------- Minimal upload route -------- */
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp|gif)/i.test(file.mimetype);
    cb(ok ? null : new Error("INVALID_TYPE"), ok);
  },
});

app.post("/api/uploads", (req, res) => {
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

/* -------- Mount all other routes -------- */
app.use("/", routes);

/* -------- Error handler -------- */
app.use(error);

export default app;
