import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 3000); // redirect after 3 seconds
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "100vh" 
    }}>
      <img src="/logo.png" alt="Logo" />
      <h1 
        style={{ 
          fontFamily: "var(--font-d)", 
          fontSize: "28px", 
          fontWeight: 700, 
          color: "var(--text)", 
          letterSpacing: "3px" 
        }}
      >
        CAMPUS CONNECT
      </h1>
      <p 
        style={{ 
          fontFamily: "var(--font-b)", 
          fontSize: "14px", 
          color: "var(--muted)" 
        }}
      >
        Your university, all in one place.
      </p>

      <div className="loading-dots">
        <span></span><span></span><span></span>
      </div>
      <div className="loading-text">Loading...</div>
    </div>
  );
}
