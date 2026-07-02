import { useState, useEffect, useRef } from "react";
import AppLayout from "../layouts/AppLayout";
import { Link } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function Profile() {
  const [form, setForm] = useState({ fullName: "", studentId: "", email: "", course: "", bio: "" });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    async function fetchProfile() {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setForm({
          fullName: data.fullName || "",
          studentId: data.studentId || "",
          email: user.email || "",
          course: data.course || "BSIT 2-1",
          bio: data.bio || "",
        });
        if (data.avatarUrl) setPreview(data.avatarUrl);
      }
    }
    fetchProfile();
  }, []);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Image must be under 2MB."); return; }
    setAvatar(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSave(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      let avatarUrl = preview;

      // Convert image to base64 and store in Firestore if new photo selected
      if (avatar) {
        avatarUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(avatar);
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        fullName: form.fullName,
        studentId: form.studentId,
        course: form.course,
        bio: form.bio,
        avatarUrl: avatarUrl || "",
      });

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to save changes. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setAvatar(null);
    setError("");
    setSuccess("");
  }

  return (
    <AppLayout>
      <div className="tab-bar">
        <Link to="/profile" className="tab active">Edit Profile</Link>
        <Link to="/profile-password" className="tab">Change Password</Link>
      </div>

      <div className="tab-content">
        <div className="profile-layout">
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-circle" onClick={() => fileRef.current.click()}
              style={{ cursor: "pointer", overflow: "hidden" }}>
              {preview
                ? <img src={preview} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="44" height="44">
                    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
              }
            </div>
            <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={handlePhotoChange} />
            <button className="btn-upload" onClick={() => fileRef.current.click()}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>Upload Photo</button>
            <div className="avatar-hint">JPG or PNG<br />Max 2MB</div>
          </div>

          {/* Profile Form */}
          <form className="profile-form" onSubmit={handleSave}>
            {error && <div className="auth-error" style={{ marginBottom: "12px" }}>{error}</div>}
            {success && <div className="auth-success" style={{ marginBottom: "12px" }}>{success}</div>}

            <div className="form-row">
              <label>Full Name</label>
              <input type="text" value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Student ID</label>
              <input type="text" value={form.studentId}
                onChange={e => setForm({ ...form, studentId: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Email Address</label>
              <input type="email" value={form.email} readOnly style={{ background: "var(--canvas)", color: "var(--muted)" }} />
            </div>
            <div className="form-row">
              <label>Course &amp; Section</label>
              <input type="text" placeholder="e.g. BSIT 2-1" value={form.course}
                onChange={e => setForm({ ...form, course: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Bio / Description</label>
              <textarea placeholder="Enter a short bio..." value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })} />
            </div>
            <div className="btn-row">
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="btn-cancel" onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}