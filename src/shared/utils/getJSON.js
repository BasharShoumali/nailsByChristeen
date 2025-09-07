export async function getJSON(url, init) {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 160)}`);
  }
  if (!ct.includes("application/json")) {
    throw new Error(`Invalid JSON (got ${ct}). Body: ${body.slice(0, 160)}`);
  }
  return JSON.parse(body);
}
