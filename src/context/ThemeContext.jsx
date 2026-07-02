import { createContext, useContext, useState, useEffect, useLayoutEffect, } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";


const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
  return localStorage.getItem("theme") || "light";
});

  useLayoutEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}, [theme]);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const snap = await getDoc(doc(db, "users", user.uid));

      if (snap.exists() && snap.data().theme) {
        const savedTheme = snap.data().theme;

        setTheme(savedTheme);
        localStorage.setItem("theme", savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }
    } catch (error) {
      console.error("Failed to load theme:", error);
    }
  });

  return () => unsubscribe();
}, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}