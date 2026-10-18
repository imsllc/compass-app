import * as Location from "expo-location";
import { Accelerometer, Magnetometer } from "expo-sensors";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { ScreenAwakeService } from "./contracts";
import { ActionsService, DeviceService, StorageService } from "./contracts";
import { angularDelta, normalize, validPoint } from "../core/navigation";

const nativeHeading =
  Platform.OS === "android"
    ? requireOptionalNativeModule("FieldHeading")
    : null;

let awakeSequence = 0;
export const screenAwake: ScreenAwakeService = {
  async acquire() {
    const tag = `field-compass-${++awakeSequence}`;
    await activateKeepAwakeAsync(tag);
    return {
      remove: () => {
        void deactivateKeepAwake(tag).catch(() => {});
      },
    };
  },
};

export const device: DeviceService = {
  async permission(request) {
    const p = await (request
      ? Location.requestForegroundPermissionsAsync()
      : Location.getForegroundPermissionsAsync());
    return p.status;
  },
  async heading(callback) {
    if (Platform.OS === "android") {
      if (!nativeHeading)
        throw new Error(
          __DEV__
            ? "The compass needs a local development build. Run npm run android; Expo Go does not include this sensor adapter."
            : "Compass sensor support is unavailable in this installation. Try reinstalling the app or contact support.",
        );
      if (nativeHeading.isEmulator())
        throw new Error(
          __DEV__
            ? "Emulator sensor readings are simulated. Choose Settings → Demo to explore the instruments."
            : "Compass readings require a physical device with a compass sensor.",
        );
      if (!nativeHeading.available())
        throw new Error(
          "Compass sensor unavailable. Use a physical device with a magnetometer.",
        );
      let smoothed: number | null = null;
      return nativeHeading.addListener(
        "heading",
        (h: {
          magnetic: number;
          true: number;
          accuracy: number;
          timestamp: number;
          flat: boolean;
        }) => {
          smoothed =
            smoothed === null
              ? h.magnetic
              : normalize(smoothed + angularDelta(smoothed, h.magnetic) * 0.3);
          const declination =
            h.true >= 0 ? angularDelta(h.magnetic, h.true) : null;
          callback({
            ...h,
            magnetic: smoothed,
            true:
              declination === null ? null : normalize(smoothed + declination),
          });
        },
      );
    }
    if (
      Platform.OS === "web" ||
      !(await Magnetometer.isAvailableAsync()) ||
      !(await Accelerometer.isAvailableAsync())
    )
      throw new Error(
        "Compass sensor unavailable. Use a physical device with a magnetometer.",
      );
    // Core Location may only emit changed headings; a live magnetometer confirms sensor liveness.
    let last: Parameters<typeof callback>[0] | null = null;
    const watch = await Location.watchHeadingAsync((h) => {
      if (Number.isFinite(h.magHeading) && h.magHeading >= 0) {
        last = {
          magnetic: h.magHeading,
          true: h.trueHeading >= 0 ? h.trueHeading : null,
          accuracy: h.accuracy,
          timestamp: Date.now(),
        };
        callback(last);
      }
    });
    Magnetometer.setUpdateInterval(200);
    const heartbeat = Magnetometer.addListener(() => {
      if (last) callback({ ...last, timestamp: Date.now() });
    });
    return {
      remove() {
        watch.remove();
        heartbeat.remove();
      },
    };
  },
  async location(callback, error) {
    if (!(await Location.hasServicesEnabledAsync()))
      throw new Error(
        "Location services are off. Enable them in device settings.",
      );
    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: 1500,
      },
      (p) => {
        if (!validPoint(p.coords)) {
          error(
            "Location provider returned invalid coordinates. Retry location.",
          );
          return;
        }
        if (nativeHeading)
          nativeHeading.setReference(
            p.coords.latitude,
            p.coords.longitude,
            p.coords.altitude ?? 0,
            p.timestamp,
          );
        callback({
          ...p.coords,
          altitude:
            p.coords.altitude != null && Number.isFinite(p.coords.altitude)
              ? p.coords.altitude
              : null,
          accuracy:
            p.coords.accuracy != null &&
            p.coords.accuracy >= 0 &&
            Number.isFinite(p.coords.accuracy)
              ? p.coords.accuracy
              : null,
          altitudeAccuracy:
            p.coords.altitudeAccuracy != null &&
            p.coords.altitudeAccuracy >= 0 &&
            Number.isFinite(p.coords.altitudeAccuracy)
              ? p.coords.altitudeAccuracy
              : null,
          timestamp: p.timestamp,
          mocked: p.mocked === true || nativeHeading?.isEmulator() === true,
        });
      },
      error,
    );
  },
  async tilt(callback) {
    if (nativeHeading?.isEmulator())
      throw new Error(
        __DEV__
          ? "Emulator tilt is simulated. Choose Settings → Demo to test the level."
          : "Level readings require a physical device with motion sensors.",
      );
    if (Platform.OS === "web" || !(await Accelerometer.isAvailableAsync()))
      throw new Error("Level sensor unavailable on this device.");
    const permission = await Accelerometer.requestPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Motion permission denied. Enable it in device settings to use the level.",
      );
    Accelerometer.setUpdateInterval(80);
    let x = 0,
      y = 0;
    return Accelerometer.addListener((a) => {
      x += (a.x - x) * 0.2;
      y += (a.y - y) * 0.2;
      callback({
        x: (Math.atan2(x, Math.sqrt(y * y + a.z * a.z)) * 180) / Math.PI,
        y: (Math.atan2(y, Math.sqrt(x * x + a.z * a.z)) * 180) / Math.PI,
        flat: Math.abs(a.z) > 0.7,
      });
    });
  },
};
export const storage: StorageService = {
  read: () => AsyncStorage.getItem("field-compass.v1"),
  write: (value) => AsyncStorage.setItem("field-compass.v1", value),
};
export const actions: ActionsService = {
  async copy(value) {
    await Clipboard.setStringAsync(value);
  },
  async share(message) {
    await Share.share({ message });
  },
  async haptic() {
    if (Platform.OS !== "web") await Haptics.selectionAsync();
  },
};
