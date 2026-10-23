/**
 * Runs the Google Health connection for the whole app, not one screen.
 *
 * It used to live inside the Connections panel on the You screen. Two things
 * depended on it running: finishing the sign-in when Google sends you back
 * with a ?code= in the address, and the quiet sync when the app opens. The app
 * always opens on Today, so neither ever happened unless you went to You.
 * Accepting on Google's screen therefore left the app saying "Not connected",
 * with the code sitting unused in the address bar.
 *
 * Mounting it here, once, above every screen, makes both happen wherever you
 * land.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useHealthSync, type HealthSync } from "./useHealthSync";

const HealthSyncContext = createContext<HealthSync | null>(null);

export function HealthSyncProvider({ children }: { children: ReactNode }) {
  const sync = useHealthSync();
  return <HealthSyncContext.Provider value={sync}>{children}</HealthSyncContext.Provider>;
}

export function useHealth(): HealthSync {
  const sync = useContext(HealthSyncContext);
  if (!sync) throw new Error("useHealth must be used inside HealthSyncProvider");
  return sync;
}
