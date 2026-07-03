import { useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import AuthLayout from "../layouts/AuthLayout";
import { Link } from "react-router-dom";
import Button from "../components/Button";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      setStatus({ type: "error", message: "Please enter your email address." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      setStatus({
        type: "success",
        message: "Reset link sent! Check your inbox (and spam folder).",
      });
    } catch (error) {
      let message = "Something went wrong. Please try again.";
      if (error.code === "auth/user-not-found") {
        message = "No account found with that email.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      }
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-logo">
        <img src="/logo.png" alt="Logo" />
        <h1>Campus Connect</h1>
        <p>Reset your password</p>
      </div>

      <p className="reset-desc">
        Enter your registered email and we'll send you a link to reset your password.
      </p>

      <div className="form-group">
        <label>Email Address</label>
        <div className="input-wrap">
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      {status.message && (
        <p style={{ color: status.type === "error" ? "red" : "green" }}>
          {status.message}
        </p>
      )}

      <Button onClick={handleSubmit} disabled={loading}>
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>

      <div className="auth-link">
        Remembered your password? <Link to="/login">Back to Login</Link>
      </div>
    </AuthLayout>
  );
}