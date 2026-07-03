import { useState } from "react";
import Sidebar from "../components/Sidebar";

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export default function AppLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-layout">
      <div className="mobile-topbar">
        <button onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
        <span>Campus Connect</span>
      </div>

      <div className={`sidebar-backdrop ${menuOpen ? "show" : ""}`} onClick={() => setMenuOpen(false)} />

      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="main-content">
        {children}
      </div>
    </div>
  );
}