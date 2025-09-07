import { useState } from "react";
import { updatePhone } from "../api";
import Field from "./Field";
import SectionTitle from "./SectionTitle";

export default function PhoneForm({ userID }) {
  const [newPhone, setNewPhone] = useState("");
  const [pwdForPhone, setPwdForPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg("");

    if (!newPhone) return setErr("Enter a new phone number.");
    if (!pwdForPhone) return setErr("Enter your password to confirm.");

    try {
      setLoading(true);
      await updatePhone({ userID, password: pwdForPhone, newPhone });
      setMsg("Phone number updated.");
      setNewPhone("");
      setPwdForPhone("");
    } catch (e) {
      setErr(e.message || "Failed to update phone.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
      <SectionTitle>Update phone number</SectionTitle>

      <Field
        label="New Phone"
        type="tel"
        value={newPhone}
        onChange={(e) =>
          setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 15))
        }
      />

      <Field
        label="Your Password"
        type="password"
        value={pwdForPhone}
        onChange={(e) => setPwdForPhone(e.target.value)}
        autoComplete="current-password"
      />

      {err && <div className="auth-error" role="alert">{err}</div>}
      {msg && <div className="auth-info">{msg}</div>}

      <button className="auth-btn" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save Phone"}
      </button>
    </form>
  );
}
