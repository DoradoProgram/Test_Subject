import { ThemeProvider } from "./context/ThemeContext";
import { NotifPrefsProvider } from "./context/NotifPrefsContext";
import { UnreadProvider } from "./context/UnreadContext";
import Router from "./router";
import "./App.css";
import "./styles/styles.css";

function App() {
  return (
    <ThemeProvider>
      <NotifPrefsProvider>
        <UnreadProvider>
          <Router />
        </UnreadProvider>
      </NotifPrefsProvider>
    </ThemeProvider>
  );
}

export default App;