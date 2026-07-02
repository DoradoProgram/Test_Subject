import { useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "firebase/auth";

function getStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { label: "Weak", color: "#dc2626", width: "25%" };
  if (score === 2) return { label: "Fair", color: "#f59e0b", width: "50%" };
  if (score === 3) return { label: "Moderate", color: "#f59e0b", width: "75%" };
  return { label: "Strong", color: "#16a34a", width: "100%" };
}

function EyeToggle({ field, show, setShow }) {
  return (
    <span
      onClick={() => setShow(s => ({ ...s, [field]: !s[field] }))}
      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--muted)" }}
    >
      {show[field]
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </span>
  );
}

export default function ProfilePassword() {
  const [form, setForm] = useState({ current: "", newPass: "", confirm: "" });
  const [show, setShow] = useState({ current: false, newPass: false, confirm: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = getStrength(form.newPass);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.current || !form.newPass || !form.confirm) {
      setError("Please fill in all fields."); return;
    }
    if (form.newPass !== form.confirm) {
      setError("New passwords do not match."); return;
    }
    if (form.newPass.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, form.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, form.newPass);
      setSuccess("Password updated successfully!");
      setForm({ current: "", newPass: "", confirm: "" });
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else {
        setError("Failed to update password. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/profile" className="tab">Edit Profile</Link>
        <Link to="/profile-password" className="tab active">Change Password</Link>
      </div>

      <div className="tab-content">
        <div style={{ maxWidth: "420px" }}>
          <h2 style={{ fontFamily: "var(--font-d)", fontSize: "20px", fontWeight: 700, color: "var(--text)", marginBottom: "20px" }}>
            Change Password
          </h2>

          {error && <div className="auth-error" style={{ marginBottom: "12px" }}>{error}</div>}
          {success && <div className="auth-success" style={{ marginBottom: "12px" }}>{success}</div>}

          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Current Password</label>
              <div style={{ position: "relative" }}>
                <input type={show.current ? "text" : "password"} placeholder="Enter current password"
                  value={form.current} onChange={e => setForm({ ...form, current: e.target.value })}
                  style={{ paddingRight: "40px" }} />
                <EyeToggle field="current" show={show} setShow={setShow} />
              </div>
            </div>

            <div className="form-row">
              <label>New Password</label>
              <div style={{ position: "relative" }}>
                <input type={show.newPass ? "text" : "password"} placeholder="Enter new password"
                  value={form.newPass} onChange={e => setForm({ ...form, newPass: e.target.value })}
                  style={{ paddingRight: "40px" }} />
                <EyeToggle field="newPass" show={show} setShow={setShow} />
              </div>
              {form.newPass && (
                <div className="pw-strength" style={{ marginTop: "8px" }}>
                  <div className="pw-bar-track">
                    <div className="pw-bar-fill" style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <div className="pw-hint">{strength.label}</div>
                </div>
              )}
            </div>

            <div className="form-row">
              <label>Confirm New Password</label>
              <div style={{ position: "relative" }}>
                <input type={show.confirm ? "text" : "password"} placeholder="Re-enter new password"
                  value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                  style={{ paddingRight: "40px" }} />
                <EyeToggle field="confirm" show={show} setShow={setShow} />
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: "20px" }}>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setForm({ current: "", newPass: "", confirm: "" })}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}