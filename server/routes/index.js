import { Router } from "express";

const r = Router();

async function mount(name, relPath) {
  try {
    const mod = await import(new URL(relPath, import.meta.url));
    const router = mod?.default;
    if (typeof router !== "function") {
      console.error(`[ROUTER ERROR] ${name}: default export missing`);
      return;
    }
    r.use("/api", router);
    console.log(`[ROUTER OK] Mounted ${name} from ${relPath}`);
  } catch (e) {
    console.error(`[IMPORT FAIL] ${name} from ${relPath}`);
    console.error(e?.stack || e);
  }
}

r.get("/api/health", (_req, res) => res.json({ ok: true }));

r.get("/api/_routes", (req, res) => {
  try {
    const out = [];
    const stack = req.app?._router?.stack || [];
    for (const layer of stack) {
      if (layer?.name === "router" && layer?.handle?.stack) {
        const base = "/api";
        for (const sub of layer.handle.stack) {
          if (sub?.route) {
            const methods = Object.keys(sub.route.methods || {})
              .filter((m) => sub.route.methods[m])
              .map((m) => m.toUpperCase());
            out.push({ path: base + sub.route.path, methods });
          }
        }
      }
      if (layer?.route) {
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());
        out.push({ path: layer.route.path, methods });
      }
    }
    res.json({ ok: true, routes: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

await mount("auth", "./auth.js");
await mount("availability", "./availability.js");
await mount("appointments", "./appointments.js");
await mount("admin", "./admin.js");
await mount("products", "./products.js");
await mount("categories", "./categories.js");
await mount("times", "./times.js");
await mount("myEvents", "./myEvents.js");
await mount("reports", "./reports.js");
await mount("adminUsers", "./adminUsers.js");
await mount("authRecover", "./authRecover.js");
await mount("account", "./account.js");
await mount("uploads", "./uploads.js");

export default r;
