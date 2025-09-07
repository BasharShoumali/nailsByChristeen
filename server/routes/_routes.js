// server/routes/_routes.js
import { Router } from "express";
const r = Router();

function listRoutes(stack, base = "") {
  const out = [];
  for (const layer of stack || []) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m])
        .map((m) => m.toUpperCase());
      out.push({ path: base + layer.route.path, methods });
    } else if (layer.name === "router" && layer.handle?.stack) {
      const prefix = layer.regexp?.fast_star ? "*" :
        (layer.regexp?.fast_slash ? "/" : (layer.regexp?.toString?.() || ""));
      // Try to pull the mount path if present
      const mount = layer?.regexp?.prefix || (layer?.path || "");
      out.push(...listRoutes(layer.handle.stack, base + (layer.path || "")));
    }
  }
  return out;
}

r.get("/_routes", (req, res) => {
  try {
    const app = req.app;
    const stack = app._router?.stack || [];
    const routes = listRoutes(stack);
    res.json({ ok: true, routes });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default r;
