import { ThemeProvider } from "./context/ThemeContext";
import Router from "./router";
import "./App.css";
import "./styles/styles.css";

function App() {
  return (
    <ThemeProvider>
      <Router />
    </ThemeProvider>
  );
}

export default App;
