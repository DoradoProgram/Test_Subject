import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

const DEFAULT_PREFS = {
  announcements: true,
  classUpdates: true,
  directMessages: true,
  upcomingEvents: false,
  systemAlerts: true,
};

const NotifPrefsContext = createContext({ notifPrefs: DEFAULT_PREFS });

/**
 * Single source of truth for the user's Notification Preferences
 * (Settings page). Other parts of the app (unread badge, announcements
 * lists, upcoming events reminders, etc.) read from here so toggling a
 * preference off actually hides the corresponding feature everywhere,
 * live, without needing a page refresh.
 */
export function NotifPrefsProvider({ children }) {
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    let unsubscribeDoc = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeDoc();

      if (!user) {
        setNotifPrefs(DEFAULT_PREFS);
        return;
      }

      unsubscribeDoc = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (snap.exists() && snap.data().notifs) {
            setNotifPrefs({ ...DEFAULT_PREFS, ...snap.data().notifs });
          } else {
            setNotifPrefs(DEFAULT_PREFS);
          }
        },
        (err) => {
          console.error("Notification prefs sync failed:", err);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDoc();
    };
  }, []);

  return (
    <NotifPrefsContext.Provider value={{ notifPrefs }}>
      {children}
    </NotifPrefsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifPrefs() {
  return useContext(NotifPrefsContext);
}