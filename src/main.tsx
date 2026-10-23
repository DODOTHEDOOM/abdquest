import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design/tokens.css";
import { App } from "./App";
import { EDITION } from "./edition";
import { HealthSyncProvider } from "./health/HealthSyncProvider";
import { Recovery } from "./Recovery";
import { StoreProvider } from "./state/StoreProvider";

const mount = document.getElementById("app");
if (mount) {
  document.title = EDITION.name;

  createRoot(mount).render(
    <StrictMode>
      {/* Outside the store on purpose: if loading the data is what throws,
          the recovery screen must still render. */}
      <Recovery>
        <StoreProvider>
          <HealthSyncProvider>
            <App />
          </HealthSyncProvider>
        </StoreProvider>
      </Recovery>
    </StrictMode>,
  );
}

/**
 * Offline support.
 *
 * Registered from exactly two kinds of address, each paired with a worker
 * written for that scope:
 *
 *  - a directory install such as /abdquest/app/, whose ./sw.js covers only
 *    that directory;
 *  - /abdquest/AbdQuest.html, the address the Home Screen icon has always
 *    opened, whose ./sw.js is the root worker that serves both this app and
 *    classic.html, each cached under its own url.
 *
 * Any other page (preview.html and friends) registers nothing. Two workers
 * cannot share a scope, and a preview has no business replacing the one that
 * keeps the real app working offline.
 */
const isDirectoryInstall = location.pathname.endsWith("/");
const isHomeScreenApp = /\/AbdQuest\.html$/.test(location.pathname);
if ("serviceWorker" in navigator && (isDirectoryInstall || isHomeScreenApp)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      // Offline support is a bonus. Failing to register must never break the app.
    });
  });
}
