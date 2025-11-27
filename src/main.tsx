import "./app.css";  // o "./App.css" según tu archivo real
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root") as HTMLElement;
createRoot(container).render(<App />);