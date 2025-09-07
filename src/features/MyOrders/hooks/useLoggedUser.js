export default function useLoggedUser() {
  try { return JSON.parse(localStorage.getItem("loggedUser") || "null"); }
  catch { return null; }
}
