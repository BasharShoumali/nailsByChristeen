import { useState, useEffect } from "react";
import {  useNavigate, useLocation } from "react-router-dom";
import "./NavBar.css";
import logo from "../footer/ck_nails.jpg";
import LogoLink from "./LogoLink";
import UserBox from "./UserBox";
import MenuToggle from "./MenuToggle";
import NavLinks from "./NavLinks";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState(null);
  const [role, setRole] = useState(null); // 'user' | 'manager' | null

  const navigate = useNavigate();
  const location = useLocation();

  const isLoggedIn = !!userName;
  const isAdmin = role === "manager";
  const onAdminPage = location.pathname.startsWith("/admin");

  // Close mobile menu whenever route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Load saved auth on mount
  useEffect(() => {
    const saved = localStorage.getItem("loggedUser");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user?.userName) setUserName(user.userName);
        if (user?.role) setRole(user.role);
      } catch {}
    }
  }, []);

  // Listen for auth changes triggered by login/logout
  useEffect(() => {
    const onAuthChanged = (e) => {
      const user = e.detail;
      setUserName(user?.userName ?? null);
      setRole(user?.role ?? null);
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(
        (import.meta?.env?.VITE_API_BASE || process.env.REACT_APP_API_URL || "http://localhost:4000") +
          "/api/logout",
        { method: "POST", credentials: "include" }
      );
    } catch { /* ignore */ }
    localStorage.removeItem("loggedUser");
    setUserName(null);
    setRole(null);
    window.dispatchEvent(new CustomEvent("auth:changed", { detail: null }));
    navigate("/login");
  };

  // Logo destination:
  const logoLink = isAdmin ? (onAdminPage ? "/" : "/admin/appointments") : "/";

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <LogoLink to={logoLink} src={logo} alt="Nails by Christeen logo" onClick={() => setMenuOpen(false)} />
        <div className="navbar-brand">Nails by Christeen</div>
      </div>

      <div className="navbar-center">
        {isLoggedIn && (
          <UserBox userName={userName} onLogout={handleLogout} />
        )}
      </div>

      <div className="navbar-right">
        <MenuToggle open={menuOpen} onToggle={() => setMenuOpen((s) => !s)} />
        <NavLinks
          isLoggedIn={isLoggedIn}
          isAdmin={isAdmin}
          onAdminPage={onAdminPage}
          menuOpen={menuOpen}
          onLinkClick={() => setMenuOpen(false)}
        />
      </div>
    </nav>
  );
}
