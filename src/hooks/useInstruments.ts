import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { device } from "../services/platform";
import {
  Fix,
  Heading,
  Permission,
  Subscription,
  Tilt,
} from "../services/contracts";
export type Demo = "off" | "tour" | "denied" | "no-sensor" | "no-location";
export function useInstruments(tab: string, demo: Demo) {
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [permission, setPermission] = useState<Permission>("undetermined");
  const [heading, setHeading] = useState<Heading | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [tilt, setTilt] = useState<Tilt | null>(null);
  const [headingError, setHeadingError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [tiltError, setTiltError] = useState("");
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) =>
      setForeground(s === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (demo === "off" && foreground)
      device
        .permission(false)
        .then((p) => {
          if (!cancelled) setPermission(p);
        })
        .catch(() => {
          if (!cancelled) setPermission("denied");
        });
    return () => {
      cancelled = true;
    };
  }, [demo, foreground, retry]);
  useEffect(() => {
    let cancelled = false;
    const subscriptions: Subscription[] = [];
    const attach = (
      promise: Promise<Subscription>,
      error: (message: string) => void,
    ) => {
      promise
        .then((s) => {
          if (cancelled) s.remove();
          else subscriptions.push(s);
        })
        .catch((e) => {
          if (!cancelled)
            error(e instanceof Error ? e.message : "Sensor unavailable.");
        });
    };
    // A new external subscription must discard readings from the previous source.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeading(null);
    setFix(null);
    setTilt(null);
    setHeadingError("");
    setLocationError("");
    setTiltError("");
    if (!foreground) return;
    if (demo !== "off") {
      if (demo === "denied") {
        setLocationError("Demo: location permission denied.");
        setHeadingError("Demo: no heading supplied.");
      } else {
        if (demo === "no-sensor") {
          setHeadingError("Demo: compass sensor unavailable.");
          setTiltError("Demo: level sensor unavailable.");
        }
        if (demo === "no-location")
          setLocationError("Demo: waiting for a location fix.");
        const start = Date.now();
        const update = () => {
          const t = (Date.now() - start) / 1000;
          if (demo !== "no-sensor") {
            setHeading({
              magnetic: (350 + t * 4) % 360,
              true: (358 + t * 4) % 360,
              accuracy: 3,
              timestamp: Date.now(),
            });
            setTilt({
              x: Math.sin(t / 3) * 3,
              y: Math.cos(t / 3) * 2,
              flat: true,
            });
          }
          if (demo !== "no-location")
            setFix({
              latitude: 40.7128,
              longitude: -74.006,
              altitude: 18,
              accuracy: 8,
              altitudeAccuracy: 12,
              timestamp: Date.now(),
              mocked: true,
            });
        };
        update();
        const timer = setInterval(update, 120);
        subscriptions.push({ remove: () => clearInterval(timer) });
      }
    } else {
      if (["Compass", "Places", "Angle"].includes(tab))
        attach(
          device.heading((h) => {
            if (!cancelled) setHeading(h);
          }),
          setHeadingError,
        );
      if (
        permission === "granted" &&
        ["Compass", "Places", "Angle"].includes(tab)
      )
        attach(
          device.location(
            (p) => {
              if (!cancelled) {
                setFix(p);
                setLocationError("");
              }
            },
            (e) => {
              if (!cancelled) setLocationError(e);
            },
          ),
          setLocationError,
        );
      if (tab === "Level")
        attach(
          device.tilt((t) => {
            if (!cancelled) setTilt(t);
          }),
          setTiltError,
        );
    }
    return () => {
      cancelled = true;
      subscriptions.forEach((s) => s.remove());
    };
  }, [tab, demo, permission, foreground, retry]);
  async function requestLocation() {
    if (demo !== "off") return;
    try {
      setPermission(await device.permission(true));
      setRetry((v) => v + 1);
    } catch {
      setLocationError(
        "Could not request location permission. Open device settings and try again.",
      );
    }
  }
  return {
    heading,
    fix,
    tilt,
    permission,
    headingError,
    locationError,
    tiltError,
    requestLocation,
    retry: () => setRetry((v) => v + 1),
    staleHeading: !!heading && now - heading.timestamp > 5000,
    staleLocation: !!fix && now - fix.timestamp > 30000,
    foreground,
  };
}
