import { useState, useEffect } from "react";
import AppLayout from "../layouts/AppLayout";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";
import { useUnread } from "../context/UnreadContext";

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useUnread();
  const [notifs, setNotifs] = useState({
    announcements: true,
    classUpdates: true,
    directMessages: true,
    upcomingEvents: false,
    systemAlerts: true,
  });
  const [userData, setUserData] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        if (data.theme) setTheme(data.theme);
        if (data.notifs) setNotifs(data.notifs);
      }
    }
    fetchSettings();
  }, []);

  async function saveSettings(newTheme, newNotifs) {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { theme: newTheme, notifs: newNotifs }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleTheme(t) {
    setTheme(t);
    saveSettings(t, notifs);
  }

  function handleToggle(key) {
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    saveSettings(theme, updated);
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  function Toggle({ on, onClick }) {
    return (
      <div onClick={onClick} style={{
        width: "42px", height: "22px",
        background: on ? "var(--text)" : "var(--border)",
        borderRadius: "11px", position: "relative",
        cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", width: "16px", height: "16px",
          background: "white", borderRadius: "50%",
          top: "3px", left: on ? "23px" : "3px",
          transition: "left 0.2s",
        }} />
      </div>
    );
  }

  const notifItems = [
    { key: "announcements", label: "Announcements", desc: "Campus-wide announcements" },
    { key: "classUpdates", label: "Class Updates", desc: "Schedule changes & cancellations" },
    { key: "directMessages", label: "Direct Messages", desc: "New message alerts" },
    { key: "upcomingEvents", label: "Upcoming Events", desc: "Event reminders" },
    { key: "systemAlerts", label: "System Alerts", desc: "Important system notifications" },
  ];

  return (
    <AppLayout>
      <div className="top-header">
        <div className="top-header-left">
          <h2>Settings</h2>
        </div>
        <div className="top-header-right">
          <button className="notif-btn" onClick={() => navigate("/messaging")}>
            <BellIcon />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button className="avatar-btn" style={{ overflow: "hidden", padding: 0 }}>
            {userData?.avatarUrl
              ? <img src={userData.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
              : <UserIcon />
            }
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="settings-content">
          {saved && <div className="auth-success" style={{ marginBottom: "16px" }}>Settings saved!</div>}

          <div className="settings-section">
            <h2>Theme</h2>
            <p style={{ fontFamily: "var(--font-b)", fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Choose your preferred display theme.
            </p>
            <div className="settings-divider"></div>
            <div className="theme-cards">
              <div className={`theme-card ${theme === "light" ? "active" : ""}`} onClick={() => handleTheme("light")}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                <h4>Light</h4>
                <p>{theme === "light" ? "Currently active" : "Tap to switch"}</p>
              </div>
              <div className={`theme-card ${theme === "dark" ? "active" : ""}`} onClick={() => handleTheme("dark")}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
                <h4>Dark</h4>
                <p>{theme === "dark" ? "Currently active" : "Tap to switch"}</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h2>Notification Preferences</h2>
            <div className="settings-divider"></div>
            {notifItems.map(item => (
              <div className="notif-row" key={item.key}>
                <div className="notif-info">
                  <h4>{item.label}</h4>
                  <p>{item.desc}</p>
                </div>
                <Toggle on={notifs[item.key]} onClick={() => handleToggle(item.key)} />
              </div>
            ))}
          </div>

          <div className="settings-section">
            <h2>Account</h2>
            <div className="settings-divider"></div>
            <button className="logout-btn" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
            <div className="logout-hint">You will be returned to the login screen.</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}