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

/**
 * Offline support, registered ONLY from a directory index.
 *
 * Two service workers cannot share a scope. Registering from
 * /abdquest/preview.html would claim /abdquest/ and take over AbdQuest.html,
 * the app in daily use, serving it from this app's cache. A path ending in "/"
 * means the app is deployed in its own directory, where its scope can only
 * cover itself.
 */
if ("serviceWorker" in navigator && location.pathname.endsWith("/")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // Offline support is a bonus. Failing to register must never break the app.
    });
  });
}
