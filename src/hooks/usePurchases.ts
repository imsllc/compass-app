import { useEffect, useSyncExternalStore } from "react";
import { purchases } from "../services/purchases";

export function usePurchases() {
  const state = useSyncExternalStore(
    purchases.subscribe,
    purchases.getState,
    purchases.getState,
  );
  useEffect(() => {
    void purchases.prepare();
  }, []);
  return state;
}
