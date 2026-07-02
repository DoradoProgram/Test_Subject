import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNotifPrefs } from "./NotifPrefsContext";

const UnreadContext = createContext({ unreadCount: 0 });

/**
 * Single source of truth for the "unread conversations" badge.
 * Runs exactly one Firestore listener for the whole app instead of
 * each consumer (Sidebar, Dashboard, Settings, ...) spinning up its own.
 */
export function UnreadProvider({ children }) {
  const [rawUnreadCount, setRawUnreadCount] = useState(0);
  const { notifPrefs } = useNotifPrefs();

  useEffect(() => {
    let unsubscribeUnread = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeUnread();

      if (!user) {
        setRawUnreadCount(0);
        return;
      }

      const conversationsQuery = query(
        collection(db, "conversations"),
        where("participants", "array-contains", user.uid)
      );

      unsubscribeUnread = onSnapshot(
        conversationsQuery,
        (snapshot) => {
          const totalUnread = snapshot.docs.filter((docSnap) => {
            const data = docSnap.data();
            return data.unread?.[user.uid] === true;
          }).length;
          setRawUnreadCount(totalUnread);
        },
        (err) => {
          console.error("Unread conversations sync failed:", err);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUnread();
    };
  }, []);

  // Respect the "Direct Messages" notification preference: when turned
  // off, the badge is fully suppressed everywhere it's shown.
  const unreadCount = notifPrefs.directMessages ? rawUnreadCount : 0;

  return (
    <UnreadContext.Provider value={{ unreadCount }}>
      {children}
    </UnreadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnread() {
  return useContext(UnreadContext);
}