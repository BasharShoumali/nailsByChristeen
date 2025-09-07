import { useState } from "react";
import { updatePassword } from "../api";
import Field from "./Field";
import SectionTitle from "./SectionTitle";

export default function PasswordForm({ userID }) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg("");

    if (!currentPwd) return setErr("Enter your current password.");
    if (!newPwd || newPwd.length < 6)
      return setErr("New password must be at least 6 characters.");
    if (newPwd !== confirmPwd)
      return setErr("New password and confirmation do not match.");

    try {
      setLoading(true);
      await updatePassword({ userID, currentPassword: currentPwd, newPassword: newPwd });
      setMsg("Password updated successfully.");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) {
      setErr(e.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <SectionTitle>Change password</SectionTitle>

      <Field
        label="Current Password"
        type="password"
        value={currentPwd}
        onChange={(e) => setCurrentPwd(e.target.value)}
        autoComplete="current-password"
      />

      <Field
        label="New Password"
        type="password"
        value={newPwd}
        onChange={(e) => setNewPwd(e.target.value)}
        autoComplete="new-password"
      />

      <Field
        label="Confirm New Password"
        type="password"
        value={confirmPwd}
        onChange={(e) => setConfirmPwd(e.target.value)}
        autoComplete="new-password"
      />

      {err && <div className="auth-error" role="alert">{err}</div>}
      {msg && <div className="auth-info">{msg}</div>}

      <button className="auth-btn" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Password"}
      </button>
    </form>
  );
}
