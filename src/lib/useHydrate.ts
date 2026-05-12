import { useEffect } from "react";
import { useStore } from "./store";

// Hydrate Zustand persist on the client only (skipHydration in store config).
export function useHydrate() {
  useEffect(() => {
    if (typeof window !== "undefined" && !useStore.persist.hasHydrated()) {
      useStore.persist.rehydrate();
    }
  }, []);
}
