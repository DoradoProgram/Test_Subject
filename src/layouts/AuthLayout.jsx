export default function AuthLayout({ children }) {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        {children}
      </div>
    </div>
  );
}
