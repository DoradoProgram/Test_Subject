import { ThemeProvider } from "./context/ThemeContext";
import { NotifPrefsProvider } from "./context/NotifPrefsContext";
import { UnreadProvider } from "./context/UnreadContext";
import { AdminProvider } from "./context/AdminContext";
import Router from "./router";
import "./App.css";
import "./styles/styles.css";
import "./styles/mobile.css";

function App() {
  return (
    <ThemeProvider>
      <NotifPrefsProvider>
        <UnreadProvider>
          <AdminProvider>
            <Router />
          </AdminProvider>
        </UnreadProvider>
      </NotifPrefsProvider>
    </ThemeProvider>
  );
}

export default App;