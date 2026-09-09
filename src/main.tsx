import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design/tokens.css";
import { App } from "./App";

const mount = document.getElementById("app");
if (mount) {
  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
