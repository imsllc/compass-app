import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { screenAwake } from "../services/platform";
import type { Subscription } from "../services/contracts";

export function useScreenAwake(enabled: boolean) {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!enabled || !active) return;
    let cancelled = false;
    let lock: Subscription | undefined;
    void screenAwake
      .acquire()
      .then((value) => {
        if (cancelled) value.remove();
        else lock = value;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      lock?.remove();
    };
  }, [enabled, active]);
}
