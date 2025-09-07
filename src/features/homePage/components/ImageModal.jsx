import { useEffect, useRef, useState } from "react";
import { API } from "../lib/apiBase";

export default function ImageModal({ open, onClose, onSave, apiBase = API, initialUrl = "" }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(initialUrl || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setErr("");
    setBusy(false);
    setPreview(initialUrl || "");
  }, [open, initialUrl]);

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }
  function onDragOver(e) { e.preventDefault(); e.stopPropagation(); }

  function handleFile(f) {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(f.type)) {
      setErr("Please select a PNG, JPG, WebP, or GIF image.");
      return;
    }
    setErr("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function doUpload() {
    if (!file) { setErr("Choose or drop an image first."); return; }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${apiBase}/api/uploads`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.url) {
        setErr(data?.error || "Upload failed.");
        setBusy(false);
        return;
      }
      await Promise.resolve(onSave?.(data.url));
      onClose?.();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="hp-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="hp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hp-img-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="hp-img-title" className="hp-modal-title">Add inspo image</h3>
        <p className="hp-modal-sub">Drop an image here or pick a file from your device.</p>

        <div className="dropzone" onDrop={onDrop} onDragOver={onDragOver} onDragEnter={onDragOver}>
          {preview ? (
            <img className="dropzone-preview" src={preview} alt="Preview" />
          ) : (
            <span className="dropzone-hint">Drag & drop image</span>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="dropzone-input"
            onChange={(e) => handleFile(e.target.files?.[0])}
            title="Choose image"
          />
          <button type="button" className="hp-btn" onClick={() => inputRef.current?.click()}>
            Choose image…
          </button>
        </div>

        {err && <div className="hp-form-err">{err}</div>}

        <div className="hp-modal-actions">
          <button className="hp-btn" type="button" onClick={onClose} disabled={busy}>Back</button>
          <button className="hp-btn primary" type="button" onClick={doUpload} disabled={busy || !file}>
            {busy ? "Uploading…" : "Save image"}
          </button>
        </div>
      </div>
    </div>
  );
}
