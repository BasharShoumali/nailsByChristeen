export const API =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:4000";
