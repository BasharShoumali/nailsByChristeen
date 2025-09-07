import { pool } from "../db/pool.js";

const TIMES_CACHE_TTL = 30_000; // 30s
const _timesCacheById = new Map(); // id -> { at, data }

function _normalizeHM(v) {
  const s = String(v ?? "").trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return s;
}
function _toHMS(v) {
  const s = String(v ?? "").trim();
  return s.length === 5 ? `${s}:00` : s; // HH:MM -> HH:MM:SS
}

export async function loadTimes(connOrPool = pool, id = 1) {
  const now = Date.now();
  const cached = _timesCacheById.get(id);
  if (cached && now - cached.at < TIMES_CACHE_TTL) return cached.data;

  const [rows] = await connOrPool.query(
    `SELECT firstApp, secondApp, thirdApp, fourthApp, fifthApp
     FROM timesOfAppointments WHERE id = ?`,
    [id]
  );
  if (!rows.length) throw Object.assign(new Error(`timesOfAppointments row missing for id=${id}`), { code: "BAD_TIME_CONFIG" });

  const r = rows[0];
  const arr = [
    _normalizeHM(r.firstApp),
    _normalizeHM(r.secondApp),
    _normalizeHM(r.thirdApp),
    _normalizeHM(r.fourthApp),
    _normalizeHM(r.fifthApp),
  ];
  const cols = ["firstApp","secondApp","thirdApp","fourthApp","fifthApp"];
  const map = new Map(); // "HH:MM" -> workday column
  arr.forEach((t, i) => map.set(t, cols[i]));

  const data = { arr, map, toHMS: _toHMS };
  _timesCacheById.set(id, { at: now, data });
  return data;
}

export function clearTimesCache() {
  _timesCacheById.clear();
}

export const SLOT_COLS = ["firstApp","secondApp","thirdApp","fourthApp","fifthApp"];
