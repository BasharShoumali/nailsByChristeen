export const CURRENCY = "₪";

export function formatISOLocal(date) {
  const d = new Date(date);
  const tzOff = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOff).toISOString().slice(0, 10);
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function toMinutes(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
export function toAmount(n) {
  const x = Number.parseFloat(String(n).replace(/[^\d.]/g, ""));
  return Number.isFinite(x) && x >= 0 ? x : NaN;
}
export function fmtMoney(n) {
  return `${CURRENCY}${Number(n || 0).toFixed(0)}`;
}
