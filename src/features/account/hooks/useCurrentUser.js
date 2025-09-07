import { useEffect, useState } from "react";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("loggedUser");
    if (!saved) return;
    try {
      const u = JSON.parse(saved);
      if (u?.userID) setUser(u);
    } catch {}
  }, []);

  return user;
}
