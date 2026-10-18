import { useEffect, useRef, useState } from "react";
import { decodeState, defaults, SavedState } from "../core/model";
import { storage } from "../services/platform";
export function useSavedState() {
  const [state, setState] = useState<SavedState>(defaults);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef(Promise.resolve());
  const [writable, setWritable] = useState(false);
  useEffect(() => {
    let active = true;
    storage
      .read()
      .then((raw) => {
        const saved = decodeState(raw);
        if (active) {
          setState(saved);
          setWritable(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Saved data could not be loaded. Changes will not overwrite it. Restart to retry.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !writable) return;
    queue.current = queue.current
      .then(() => storage.write(JSON.stringify(state)))
      .then(() => setError(""))
      .catch(() =>
        setError(
          "Changes could not be saved. Check device storage; retry by changing a setting.",
        ),
      );
  }, [state, ready, writable]);
  return { state, setState, ready, error, canPersist: ready && writable };
}
