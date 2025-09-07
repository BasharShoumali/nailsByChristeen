import { useState } from "react";
import { recoverPassword } from "../api"; 
import "../../../cssFiles/ForgotPassword.css";

export default function ForgotPasswordPage() {
  const [form, setForm] = useState({ userID:"", userName:"", fullName:"", phone:"", dob:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState(false);  // for copy feedback

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "userID") v = v.replace(/\D/g, "").slice(0, 12);
    if (k === "phone")  v = v.replace(/\D/g, "").slice(0, 15);
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setPassword("");
    if (!form.userID || !form.phone || !form.dob || (!form.userName && !form.fullName)) {
      setError("Please fill UserID, Phone, DOB, and Username or Full Name."); return;
    }
    try {
      setLoading(true);
      const payload = {
        userID: Number(form.userID),
        userName: form.userName.trim(),
        fullName: form.fullName.trim(),
        phone: form.phone,
        dob: form.dob,
      };
      const data = await recoverPassword(payload);
      if (!data?.ok) throw new Error(data?.error || "Verification failed.");
      if (!data.password) throw new Error("No password returned by server.");
      setPassword(String(data.password));
      setShowPwd(false);
      setCopied(false); // reset copy state when new password arrives
    } catch (err) {
      setError(err.message || "Could not verify your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // reset after 2s
    });
  };

  return (
    <div className="auth-wrap is-in">
      <form className={`auth-card ${error ? "shake" : ""}`} onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-sub">If your details match, a temporary password will appear below.</p>

        <div className="fld">
          <input className="fld-input" type="text" placeholder=" " inputMode="numeric" pattern="[0-9]*"
                 value={form.userID} onChange={onChange("userID")} required/>
          <label className="fld-label">User ID</label>
        </div>

        <div className="fld">
          <input className="fld-input" type="text" placeholder=" "
                 value={form.userName} onChange={onChange("userName")}/>
          <label className="fld-label">Username (optional)</label>
        </div>

        <div className="fld">
          <input className="fld-input" type="text" placeholder=" "
                 value={form.fullName} onChange={onChange("fullName")}/>
          <label className="fld-label">Full Name (optional)</label>
        </div>

        <div className="fld">
          <input className="fld-input" type="tel" placeholder=" " inputMode="numeric" pattern="[0-9]*"
                 value={form.phone} onChange={onChange("phone")} required/>
          <label className="fld-label">Phone</label>
        </div>

        <div className="fld">
          <input className="fld-input" type="date" placeholder=" "
                 value={form.dob} onChange={onChange("dob")} required/>
          <label className="fld-label">Date of Birth</label>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>

        {password && (
          <div className="success-message" style={{ marginTop: 12 }}>
            ✅ Verified!
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              <label className="chk" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={showPwd} onChange={() => setShowPwd(s => !s)} />
                <span>Show password</span>
              </label>

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "1px solid var(--ring)",
                borderRadius: "10px",
                padding: "10px 12px",
                background: "#fff",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontWeight: 700,
                letterSpacing: 0.3,
                userSelect: "all",
              }}>
                <span style={{ flex: 1 }}>
                  {showPwd ? password : "••••••••"}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
