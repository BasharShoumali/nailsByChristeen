import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api";
import "../../../cssFiles/LogIn.css";

export default function LoginPage() {
  const navigate = useNavigate();

  // form state
  const [identifier, setIdentifier] = useState(""); // username or phone
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [touched, setTouched] = useState({ identifier: false, pwd: false });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // validation (username ≥3 OR phone with ≥7 digits)
  const isPhone = (v) => v.replace(/\D/g, "").length >= 7;
  const isUser = (v) => v.trim().length >= 3;
  const idOk = isPhone(identifier) || isUser(identifier);
  const pwdOk = pwd.length >= 6;
  const formOk = idOk && pwdOk && !loading;

  useEffect(() => {
    if (err) setErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, pwd]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched({ identifier: true, pwd: true });
    setErr("");
    if (!formOk) return;

    try {
      setLoading(true);
      const user = await login({
        userNameOrPhone: identifier.trim(),
        password: pwd,
      });

      // Persist minimal user; UI can read role from here
      try {
        localStorage.setItem("loggedUser", JSON.stringify(user));
        window.dispatchEvent(new CustomEvent("auth:changed", { detail: user }));
      } catch {}

      // Route by role (server must still protect admin APIs)
      navigate(user.role === "manager" ? "/admin/appointments" : "/");
    } catch (e2) {
      const msg = String(e2?.message || "");
      if (/401|invalid credentials/i.test(msg)) {
        setErr("Invalid credentials.");
      } else if (/400/.test(msg)) {
        setErr("Missing or invalid fields.");
      } else if (/HTTP 5\d{2}/.test(msg)) {
        setErr("Server error. Please try again.");
      } else {
        setErr(msg || "Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  // mount animation flag
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={`auth-wrap ${mounted ? "is-in" : ""}`}>
      <div className="bg-anim" aria-hidden="true" />
      <form className={`auth-card ${err ? "shake" : ""}`} onSubmit={onSubmit} noValidate>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Log in to manage your appointments</p>

        {/* Username or Phone */}
        <div className="fld">
          <input
            id="identifier"
            className={`fld-input ${touched.identifier && !idOk ? "invalid" : ""}`}
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, identifier: true }))}
            required
            placeholder=" "
            autoComplete="username"
            disabled={loading}
          />
          <label htmlFor="identifier" className="fld-label">Username or Phone</label>
          {touched.identifier && !idOk && (
            <div className="auth-hint">Enter a username (min 3 chars) or a valid phone number.</div>
          )}
        </div>

        {/* Password */}
        <div className="fld">
          <input
            id="password"
            className={`fld-input ${touched.pwd && !pwdOk ? "invalid" : ""}`}
            type={showPwd ? "text" : "password"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, pwd: true }))}
            required
            placeholder=" "
            autoComplete="current-password"
            disabled={loading}
          />
          <label htmlFor="password" className="fld-label">Password</label>
          <button
            type="button"
            className="toggle-pwd"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? "Hide password" : "Show password"}
            disabled={loading}
          >
            {showPwd ? "🙈" : "👁️"}
          </button>
          {touched.pwd && !pwdOk && <div className="auth-hint">Minimum 6 characters.</div>}
        </div>

        <div className="auth-row">
          <label className="chk">
            <input type="checkbox" disabled={loading} /> <span>Remember me</span>
          </label>
          <Link to="/forgot" className="auth-link">Forgot password?</Link>
        </div>

        {err && <div className="auth-error">{err}</div>}

        <button className="auth-btn" type="submit" disabled={!formOk}>
          {loading ? "Signing in…" : "Log In"}
        </button>

        <p className="auth-foot">
          Don’t have an account? <Link to="/signup" className="auth-link">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
