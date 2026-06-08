import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

// Agent dual-mode: bump tap targets + expose actions when driven by an agent.
const params = new URLSearchParams(location.search);
if (params.has("agent") || params.get("mode") === "agent") {
  document.documentElement.setAttribute("data-agent", "true");
}

createRoot(document.getElementById("app")!).render(<App />);
