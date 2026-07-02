import AuthLayout from "../layouts/AuthLayout";
import { Link } from "react-router-dom";
import Button from "../components/Button";

export default function ForgotPassword() {
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
          <input type="email" placeholder="Enter your email address" />
        </div>
      </div>

      <Button>Send Reset Link</Button>

      <div className="auth-link">
        Remembered your password? <Link to="/login">Back to Login</Link>
      </div>
    </AuthLayout>
  );
}
