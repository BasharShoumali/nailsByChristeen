// src/features/auth/pages/SignupPage.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../../cssFiles/Signup.css";

/** Normalize API base: prefer env, fall back to localhost. Always end with /api */
const API_ORIGIN =
  (import.meta?.env?.VITE_API_URL ||
    process.env.REACT_APP_API_URL ||
    "http://localhost:4000").replace(/\/+$/, "");

const API_BASE = API_ORIGIN.endsWith("/api") ? API_ORIGIN : `${API_ORIGIN}/api`;

export default function SignupPage() {
  const navigate = useNavigate();

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // form state
  const [userID, setUserID] = useState(""); // numeric
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [dob, setDob] = useState(""); // yyyy-mm-dd
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // errors
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState({
    userID: "",
    userName: "",
    phoneNumber: "",
  });

  // validation
  const userIDOk = /^\d+$/.test(userID.trim()); // numeric only
  const nameOk = firstName.trim().length > 0 && lastName.trim().length > 0;
  const userOk = userName.trim().length >= 3;
  const dobOk = !!dob;
  const pwdOk = password.length >= 6;
  const matchOk = password && password === confirm;

  const formOk =
    userIDOk && nameOk && userOk && dobOk && pwdOk && matchOk && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setFieldErr({ userID: "", userName: "", phoneNumber: "" });

    if (!formOk) {
      setErr("Please fill out all required fields correctly.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        userID: parseInt(userID.trim(), 10),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: userName.trim(),
        dateOfBirth: dob || null,
        phoneNumber: phoneNumber || null,
        password,
      };

      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // success (backend returns 201 + {ok:true})
      if (res.ok) {
        setSubmitted(true);
        return;
      }

      // error cases
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        const msg = String(data.error || "That value is already in use.").toLowerCase();
        setErr(data.error || "That value is already in use.");
        if (msg.includes("userid")) {
          setFieldErr((f) => ({ ...f, userID: "That User ID is already in use." }));
        }
        if (msg.includes("username")) {
          setFieldErr((f) => ({ ...f, userName: "That username is already taken." }));
        }
        if (msg.includes("phone")) {
          setFieldErr((f) => ({ ...f, phoneNumber: "That phone is already in use." }));
        }
      } else if (res.status === 400) {
        setErr(data.error || "Missing or invalid fields.");
      } else {
        setErr(data.error || "Server error. Please try again.");
      }
    } catch {
      setErr("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className={`auth-wrap ${mounted ? "is-in" : ""}`}>
        <form className="auth-card">
          <h1 className="auth-title">Account Created</h1>
          <p className="auth-sub">You can now log in with your credentials.</p>
          <button
            type="button"
            className="auth-btn"
            onClick={() => navigate("/login")}
          >
            Go to Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`auth-wrap ${mounted ? "is-in" : ""}`}>
      <form
        className={`auth-card ${err ? "shake" : ""}`}
        onSubmit={handleSubmit}
        noValidate
      >
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-sub">Fill in your details to sign up</p>

        {/* User ID (numeric) */}
        <div className="fld">
          <input
            type="text"
            className={`fld-input ${userID && !userIDOk ? "invalid" : ""} ${
              fieldErr.userID ? "invalid" : ""
            }`}
            value={userID}
            onChange={(e) => setUserID(e.target.value)}
            required
            placeholder=" "
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-invalid={!!(userID && !userIDOk)}
          />
          <label className="fld-label">User ID (numeric)</label>
          {userID && !userIDOk && (
            <div className="auth-hint">Enter a valid numeric ID.</div>
          )}
          {fieldErr.userID && (
            <div className="auth-hint">{fieldErr.userID}</div>
          )}
        </div>

        {/* First Name */}
        <div className="fld">
          <input
            type="text"
            className="fld-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder=" "
            autoComplete="given-name"
          />
          <label className="fld-label">First Name</label>
        </div>

        {/* Last Name */}
        <div className="fld">
          <input
            type="text"
            className="fld-input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder=" "
            autoComplete="family-name"
          />
          <label className="fld-label">Last Name</label>
        </div>

        {/* Username */}
        <div className="fld">
          <input
            type="text"
            className={`fld-input ${fieldErr.userName ? "invalid" : ""}`}
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
            placeholder=" "
            autoComplete="username"
          />
          <label className="fld-label">Username</label>
          {!userOk && userName && (
            <div className="auth-hint">At least 3 characters.</div>
          )}
          {fieldErr.userName && (
            <div className="auth-hint">{fieldErr.userName}</div>
          )}
        </div>

        {/* Date of Birth */}
        <div className="fld">
          <input
            type="date"
            className="fld-input"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
            placeholder=" "
            autoComplete="bday"
          />
          <label className="fld-label">Date of Birth</label>
        </div>

        {/* Phone (optional) */}
        <div className="fld">
          <input
            type="tel"
            className={`fld-input ${fieldErr.phoneNumber ? "invalid" : ""}`}
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder=" "
            autoComplete="tel"
          />
          <label className="fld-label">Phone Number (optional)</label>
          {fieldErr.phoneNumber && (
            <div className="auth-hint">{fieldErr.phoneNumber}</div>
          )}
        </div>

        {/* Password */}
        <div className="fld">
          <input
            type={showPwd ? "text" : "password"}
            className={`fld-input ${password && !pwdOk ? "invalid" : ""}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder=" "
            autoComplete="new-password"
          />
          <label className="fld-label">Password</label>
          <button
            type="button"
            className="toggle-pwd"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? "Hide password" : "Show password"}
          >
            {showPwd ? "🙈" : "👁️"}
          </button>
          {password && !pwdOk && (
            <div className="auth-hint">Minimum 6 characters.</div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="fld">
          <input
            type={showConfirmPwd ? "text" : "password"}
            className={`fld-input ${confirm && !matchOk ? "invalid" : ""}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder=" "
            autoComplete="new-password"
          />
          <label className="fld-label">Confirm Password</label>
          <button
            type="button"
            className="toggle-pwd"
            onClick={() => setShowConfirmPwd((s) => !s)}
            aria-label={showConfirmPwd ? "Hide password" : "Show password"}
          >
            {showConfirmPwd ? "🙈" : "👁️"}
          </button>
          {confirm && !matchOk && (
            <div className="auth-hint">Passwords don’t match.</div>
          )}
        </div>

        {err && <div className="auth-error">{err}</div>}

        <button className="auth-btn" type="submit" disabled={!formOk}>
          {loading ? "Creating..." : "Sign Up"}
        </button>

        <p className="auth-foot">
          Already have an account?{" "}
          <Link className="auth-link" to="/login">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
