import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import AuthLayout from "../layouts/AuthLayout";
import Button from "../components/Button";

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    studentId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({ password: false, confirmPassword: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName || !form.studentId || !form.email || !form.password || !form.confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: form.fullName });
      await setDoc(doc(db, "users", user.uid), {
        fullName: form.fullName,
        studentId: form.studentId,
        email: form.email,
        createdAt: new Date(),
      });
      setSuccess("Account created successfully! Redirecting...");
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit}>
        <div className="auth-logo">
          <img src="/logo.png" alt="Logo" />
          <h1>Campus Connect</h1>
          <p>Create your account</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <div className="form-group">
          <label>Full Name</label>
          <div className="input-wrap">
            <input type="text" name="fullName" placeholder="Enter your full name"
              value={form.fullName} onChange={handleChange} autoComplete="name" />
          </div>
        </div>

        <div className="form-group">
          <label>Student ID</label>
          <div className="input-wrap">
            <input type="text" name="studentId" placeholder="Enter your student ID"
              value={form.studentId} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label>Email Address</label>
          <div className="input-wrap">
            <input type="email" name="email" placeholder="Enter your email address"
              value={form.email} onChange={handleChange} autoComplete="email" />
          </div>
        </div>

        <div className="form-group">
          <label>Password</label>
          <div className="input-wrap">
            <input
              type={show.password ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <span
              className="eye-icon"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onClick={() => setShow(s => ({ ...s, password: !s.password }))}
            >
              {show.password ? <EyeOffIcon /> : <EyeIcon />}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label>Confirm Password</label>
          <div className="input-wrap">
            <input
              type={show.confirmPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
            />
            <span
              className="eye-icon"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onClick={() => setShow(s => ({ ...s, confirmPassword: !s.confirmPassword }))}
            >
              {show.confirmPassword ? <EyeOffIcon /> : <EyeIcon />}
            </span>
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Creating Account..." : "Create Account"}
        </Button>

        <div className="auth-link">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </form>
    </AuthLayout>
  );
}