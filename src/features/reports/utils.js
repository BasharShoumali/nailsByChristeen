/* ----- date helpers ----- */
export function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function ymKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function firstOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
export function defaultRange() {
  const today = new Date();
  const to = firstOfMonth(today);
  const from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
  return { fromISO: ymdLocal(from), toISO: ymdLocal(to) };
}

/* ----- formatters ----- */
export const money = (n) =>
  `₪${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
export const num = (n) => Number(n || 0).toLocaleString();

/* Build continuous month sequence (inclusive) with zeros */
export function buildClientMonths(fromISO, toISO) {
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  const start = new Date(fy, (fm || 1) - 1, 1);
  const end = new Date(ty, (tm || 1) - 1, 1);

  const out = [];
  for (let d = new Date(start); d <= end; d = addMonths(d, 1)) {
    out.push({
      ym: ymKey(d),
      label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      appts: 0,
      revenue: 0,
    });
  }
  return out;
}
