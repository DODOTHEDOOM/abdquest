import type { ReactNode } from "react";
import { StoreContext, useCreateStore } from "./store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useCreateStore();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
