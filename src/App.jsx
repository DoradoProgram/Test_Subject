import { ThemeProvider } from "./context/ThemeContext";
import { UnreadProvider } from "./context/UnreadContext";
import Router from "./router";
import "./App.css";
import "./styles/styles.css";

function App() {
  return (
    <ThemeProvider>
      <UnreadProvider>
        <Router />
      </UnreadProvider>
    </ThemeProvider>
  );
}

export default App;