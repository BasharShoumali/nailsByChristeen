import { pool } from "../db/pool.js";

export async function getUserDisplay(connOrPool, userID) {
  const [[u]] = await connOrPool.query(
    "SELECT userName FROM users WHERE userID = ?",
    [userID]
  );
  if (u?.userName && String(u.userName).trim()) return String(u.userName).trim();
  return String(userID);
}

export async function getUserRole(connOrPool = pool, userID) {
  const [[row]] = await connOrPool.query(
    "SELECT role FROM users WHERE userID = ?",
    [userID]
  );
  return row?.role || "user";
}
