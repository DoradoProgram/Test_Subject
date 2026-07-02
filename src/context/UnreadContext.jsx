import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const UnreadContext = createContext({ unreadCount: 0 });

/**
 * Single source of truth for the "unread conversations" badge.
 * Runs exactly one Firestore listener for the whole app instead of
 * each consumer (Sidebar, Dashboard, Settings, ...) spinning up its own.
 */
export function UnreadProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsubscribeUnread = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeUnread();

      if (!user) {
        setUnreadCount(0);
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
          setUnreadCount(totalUnread);
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