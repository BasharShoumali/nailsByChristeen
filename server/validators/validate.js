export function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}
export function isHMTime(s) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
}
