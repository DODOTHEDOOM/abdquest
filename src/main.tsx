import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design/tokens.css";
import { App } from "./App";
import { EDITION } from "./edition";
import { StoreProvider } from "./state/StoreProvider";

const mount = document.getElementById("app");
if (mount) {
  document.title = EDITION.name;

  createRoot(mount).render(
    <StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StrictMode>,
  );
}
