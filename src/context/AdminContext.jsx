import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

const AdminContext = createContext({ isAdmin: false, adminLoading: true });

/**
 * Single source of truth for whether the current user has admin
 * privileges. Admin status lives on the user's Firestore doc
 * (users/{uid}.isAdmin === true). There's no self-service way to
 * become an admin — set the field manually in Firestore (or via a
 * trusted backend script) for the accounts that should have access.
 */
export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeDoc();

      if (!user) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      unsubscribeDoc = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          setIsAdmin(!!(snap.exists() && snap.data().isAdmin === true));
          setAdminLoading(false);
        },
        (err) => {
          console.error("Admin status sync failed:", err);
          setIsAdmin(false);
          setAdminLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDoc();
    };
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, adminLoading }}>
      {children}
    </AdminContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  return useContext(AdminContext);
}