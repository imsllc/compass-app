import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  angularDelta,
  bearing,
  coordinate,
  coordinates,
  distance,
  formatAltitude,
  formatDistance,
  formatUncertainty,
  normalize,
} from "./src/core/navigation";
import { makePlace, placeIcons, Settings, Place } from "./src/core/model";
import { Demo, useInstruments } from "./src/hooks/useInstruments";
import { useSavedState } from "./src/hooks/useSavedState";
import { actions } from "./src/services/platform";
import {
  Body,
  Button,
  Card,
  Choices,
  dark,
  Label,
  light,
  night,
  s,
  Theme,
  Toggle,
} from "./src/ui";
import { Slot, router, usePathname } from "expo-router";
import { CompassFace } from "./src/components/CompassFace";
import { useScreenAwake } from "./src/hooks/useScreenAwake";
import { AdBanner, AdPrivacyOptions } from "./src/components/AdBanner";
import { RemoveAds } from "./src/components/RemoveAds";
type Tab = "Compass" | "Places" | "Level" | "Angle" | "Settings";

function FieldCompass() {
  const system = useColorScheme();
  const {
    state,
    setState,
    ready,
    error: storageError,
    canPersist,
  } = useSavedState();
  const settings = state.settings;
  useScreenAwake(ready && settings.keepAwake);
  const base = settings.night
    ? night
    : settings.theme === "dark" ||
        (settings.theme === "system" && system === "dark")
      ? dark
      : light;
  const c = settings.contrast
    ? { ...base, muted: base.ink, line: base.ink }
    : base;
  const pathname = usePathname();
  const routes = {
    Compass: "/",
    Places: "/places",
    Level: "/level",
    Angle: "/angle",
    Settings: "/settings",
  } as const;
  const tab =
    (Object.keys(routes) as Tab[]).find((key) => routes[key] === pathname) ??
    "Compass";
  const setTab = (next: Tab) => router.navigate(routes[next]);
  const [demoSelection, setDemo] = useState<Demo>("off");
  const demo: Demo = __DEV__ ? demoSelection : "off";
  const [reduced, setReduced] = useState(false);
  const [calibrate, setCalibrate] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedId, selectId] = useState<string | null>(null);
  const [form, showForm] = useState(false);
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [icon, setIcon] = useState<string>(placeIcons[0]);
  const [formError, setFormError] = useState("");
  const [zero, setZero] = useState({ x: 0, y: 0 });
  const [angleStart, setAngleStart] = useState<number | null>(null);
  const [angleEnd, setAngleEnd] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formSource, setFormSource] = useState<Place["source"]>("manual");
  const sensors = useInstruments(
    form || calibrate || deleteId !== null ? "Paused" : tab,
    demo,
  );
  function resetMeasurements() {
    setAngleStart(null);
    setAngleEnd(null);
    setZero({ x: 0, y: 0 });
  }
  function changeDemo(value: Demo) {
    if (!__DEV__) return;
    resetMeasurements();
    setDemo(value);
  }
  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === "north") resetMeasurements();
    setState((v) => ({ ...v, settings: { ...v.settings, [key]: value } }));
  }
  const liveHeading =
    sensors.heading && !sensors.staleHeading
      ? settings.north === "magnetic"
        ? sensors.heading.magnetic
        : sensors.fix && !sensors.staleLocation
          ? sensors.heading.true
          : null
      : null;
  const heading = liveHeading === null ? null : normalize(liveHeading);
  const selected = state.places.find((p) => p.id === selectedId);
  const fix = sensors.fix;
  const usableFix = fix && !sensors.staleLocation ? fix : null;
  const trueHeading = sensors.heading?.true;
  const magneticOffset =
    sensors.heading && trueHeading != null
      ? angularDelta(sensors.heading.magnetic, trueHeading)
      : null;
  const placeBearing =
    usableFix && selected && distance(usableFix, selected) >= 1
      ? bearing(usableFix, selected)
      : null;
  const target =
    placeBearing === null
      ? null
      : settings.north === "true"
        ? placeBearing
        : magneticOffset === null
          ? null
          : normalize(placeBearing - magneticOffset);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (form) {
        showForm(false);
        return true;
      }
      if (calibrate) {
        setCalibrate(false);
        return true;
      }
      if (tab !== "Compass") {
        router.replace("/");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab, form, calibrate]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const lastSector = useRef<number | null>(null);
  useEffect(() => {
    const sector = heading === null ? null : Math.round(heading / 90) % 4;
    if (
      settings.haptics &&
      sector !== null &&
      lastSector.current !== null &&
      sector !== lastSector.current
    )
      actions.haptic().catch(() => {});
    lastSector.current = sector;
  }, [heading, settings.haptics]);
  async function perform(action: () => Promise<void>, success?: string) {
    try {
      await action();
      if (success) setNotice(success);
    } catch {
      setNotice("That action could not be completed. Please try again.");
    }
  }
  function openForm() {
    setFormSource(demo !== "off" ? "demo" : fix?.mocked ? "mock" : "manual");
    setName("");
    setIcon(placeIcons[0]);
    setLatitude(usableFix?.latitude.toString() ?? "");
    setLongitude(usableFix?.longitude.toString() ?? "");
    setFormError("");
    showForm(true);
  }
  function savePlace() {
    try {
      if (!canPersist)
        throw new Error(
          "Local storage is unavailable. Restart the app before saving a place.",
        );
      if (!latitude.trim() || !longitude.trim())
        throw new Error("Enter both latitude and longitude.");
      if (state.places.length >= 500)
        throw new Error("Place limit reached (500). Remove a place first.");
      const p = makePlace(
        name,
        icon,
        {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
        formSource,
      );
      setState((v) => ({ ...v, places: [...v.places, p] }));
      selectId(p.id);
      showForm(false);
      setNotice("Place added to your collection.");
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  const headingMessage =
    sensors.headingError ||
    (sensors.staleHeading
      ? "Heading is stale. Keep the app open and retry."
      : !sensors.heading
        ? "Waiting for compass sensor…"
        : settings.north === "true" && heading === null
          ? "True north needs a fresh location and a platform-adjusted heading."
          : sensors.heading.flat === false
            ? "Lay the phone face up for a useful compass reading."
            : sensors.heading.accuracy < 2
              ? "Low compass calibration. Move away from metal and calibrate."
              : "Hold the phone flat, with its top edge pointing forward.");
  const locationMessage =
    sensors.locationError ||
    (sensors.staleLocation
      ? "Location is stale. Distance and direction are paused."
      : !fix
        ? sensors.permission === "denied"
          ? "Location permission denied. You can still enter places manually."
          : sensors.permission === "granted"
            ? "Waiting for a fresh location fix. Try outdoors with a clear sky."
            : "Enable location for coordinates, altitude, and directions."
        : fix.mocked
          ? "Mock location reported by device."
          : "Foreground location · stored only when you save a place");
  const angle =
    angleStart === null || (angleEnd ?? heading) === null
      ? null
      : angularDelta(angleStart, (angleEnd ?? heading)!);
  function placeSummary(p: (typeof state.places)[number]) {
    if (!usableFix) return "Waiting for a fresh location";
    const d = distance(usableFix, p);
    if (d < 1) return "At this coordinate · direction undefined";
    const b = bearing(usableFix, p);
    const relative =
      trueHeading != null && !sensors.staleHeading
        ? angularDelta(trueHeading, b)
        : null;
    return `${formatDistance(d, settings.units)} · ${Math.round(b)}° true${relative === null ? "" : ` · ${Math.abs(relative) < 3 ? "ahead" : `${Math.round(Math.abs(relative))}° ${relative < 0 ? "left" : "right"}`}`}`;
  }
  function enableLocation() {
    if (demo !== "off") {
      changeDemo("off");
      return;
    }
    if (sensors.permission === "denied")
      void perform(() => Linking.openSettings());
    else void sensors.requestLocation();
  }
  const screens: Record<Tab, React.ReactNode> = {
    Compass: (
      <CompassFace
        heading={heading}
        north={settings.north}
        changeNorth={(value) => change("north", value)}
        reduced={reduced}
        target={target}
        warning={
          heading === null ||
          sensors.heading?.flat === false ||
          (sensors.heading?.accuracy ?? 0) < 2
            ? headingMessage
            : ""
        }
        onWarning={() =>
          setTab(
            settings.north === "true" && heading === null && !usableFix
              ? "Places"
              : "Settings",
          )
        }
      />
    ),
    Places: (
      <>
        <Text style={[s.title, { color: c.ink }]}>Places</Text>
        <Body>
          Private, offline, and always yours. Bearings are geographic (true
          north).
        </Body>
        <Card>
          <View style={s.rowBetween}>
            <Label>YOUR LOCATION</Label>
            <Text style={{ color: c.accent, fontSize: 12 }}>
              {sensors.staleLocation
                ? "STALE"
                : fix
                  ? "FIX AVAILABLE"
                  : "NO FIX"}
            </Text>
          </View>
          {fix && (
            <>
              <Text selectable style={[s.coordinate, { color: c.ink }]}>
                {coordinate(fix.latitude, true, settings.format)}
                {"\n"}
                {coordinate(fix.longitude, false, settings.format)}
              </Text>
              <View style={s.stats}>
                <View style={s.flex}>
                  <Label>ALTITUDE · WGS84</Label>
                  <Text style={[s.value, { color: c.ink }]}>
                    {fix.altitude === null
                      ? "Unavailable"
                      : formatAltitude(fix.altitude, settings.units)}
                  </Text>
                  <Body>
                    {fix.altitudeAccuracy == null
                      ? "Accuracy unavailable"
                      : `± ${formatUncertainty(fix.altitudeAccuracy, settings.units)}`}
                  </Body>
                </View>
                <View style={s.flex}>
                  <Label>HORIZONTAL</Label>
                  <Text style={[s.value, { color: c.ink }]}>
                    {fix.accuracy === null
                      ? "Unavailable"
                      : `± ${formatUncertainty(fix.accuracy, settings.units)}`}
                  </Text>
                  <Body>Reported uncertainty</Body>
                </View>
              </View>
            </>
          )}
          <Body>{locationMessage}</Body>
          {!fix && (
            <>
              <Body>
                Location is used while this screen is open. No background
                tracking.
              </Body>
              <Button
                title={
                  demo !== "off"
                    ? "Exit demo to enable location"
                    : sensors.permission === "denied"
                      ? "Open device settings"
                      : sensors.permission === "granted"
                        ? "Retry location"
                        : "Enable location"
                }
                onPress={enableLocation}
              />
            </>
          )}
          {fix && (
            <View style={s.wrap}>
              <Button
                title="Copy"
                small
                onPress={() =>
                  void perform(
                    () =>
                      actions.copy(
                        `${coordinates(fix, settings.format)}${demo !== "off" || fix.mocked ? " (simulated / mock)" : ""}${sensors.staleLocation ? " (stale)" : ""}`,
                      ),
                    "Coordinates copied.",
                  )
                }
              />
              <Button
                title="Share"
                small
                onPress={() =>
                  void perform(() =>
                    actions.share(
                      `${coordinates(fix, settings.format)}${demo !== "off" || fix.mocked ? " (simulated / mock location)" : ""}${sensors.staleLocation ? " (stale location)" : ""}`,
                    ),
                  )
                }
              />
              <Button
                title="Save place"
                small
                onPress={openForm}
                disabled={!usableFix}
              />
            </View>
          )}
        </Card>
        <Card>
          <Label>BEARINGS TO KEEP</Label>
          {selected ? (
            <>
              <Text style={[s.sectionTitle, { color: c.ink }]}>
                {selected.icon} {selected.name}
                {selected.source === "demo" || selected.source === "mock"
                  ? " (simulated)"
                  : ""}
              </Text>
              <Body>{placeSummary(selected)}</Body>
              {target === null && usableFix && (
                <Body>
                  Relative direction needs a true heading from the platform. No
                  magnetic/true estimate is substituted.
                </Body>
              )}
            </>
          ) : (
            <Body>Save a trailhead, a campsite, or the way back.</Body>
          )}
          {selected && (
            <Button title="Clear destination" onPress={() => selectId(null)} />
          )}
        </Card>
        <Button title="+ Add place" onPress={openForm} selected />
        {state.places.length === 0 && (
          <Card>
            <Text style={[s.sectionTitle, { color: c.ink }]}>
              A point to come back to.
            </Text>
            <Body>
              Save your current location or enter coordinates manually. Places
              stay on this device.
            </Body>
          </Card>
        )}
        {state.places.map((p) => (
          <Card key={p.id}>
            <View style={s.rowBetween}>
              <Text style={[s.sectionTitle, s.flex, { color: c.ink }]}>
                {p.icon} {p.name}
                {p.source === "demo" || p.source === "mock"
                  ? " (simulated)"
                  : ""}
              </Text>
              {selectedId === p.id && <Label>SELECTED</Label>}
            </View>
            <Body>{placeSummary(p)}</Body>
            <Text selectable style={[s.body, { color: c.muted }]}>
              {coordinates(p, settings.format)}
            </Text>
            <View style={s.wrap}>
              <Button
                small
                title="Navigate"
                onPress={() => {
                  selectId(p.id);
                  setTab("Compass");
                }}
              />
              <Button
                small
                title="Share"
                onPress={() =>
                  void perform(() =>
                    actions.share(
                      `${p.name}${p.source === "demo" || p.source === "mock" ? " (simulated)" : ""}: ${coordinates(p, settings.format)}`,
                    ),
                  )
                }
              />
              <Button small title="Delete" onPress={() => setDeleteId(p.id)} />
            </View>
          </Card>
        ))}
      </>
    ),
    Level: (
      <>
        <Text style={[s.title, { color: c.ink }]}>Bubble level</Text>
        <Body>
          Lay the phone face up on a surface. Remove a raised case for a more
          useful reading.
        </Body>
        <View
          style={[s.level, { borderColor: c.line, backgroundColor: c.card }]}
          accessibilityLabel={
            sensors.tilt
              ? `Tilt X ${(sensors.tilt.x - zero.x).toFixed(1)}, Y ${(sensors.tilt.y - zero.y).toFixed(1)} degrees`
              : "No tilt reading"
          }
        >
          <View style={[s.crossH, { backgroundColor: c.line }]} />
          <View style={[s.crossV, { backgroundColor: c.line }]} />
          <View style={[s.levelRing, { borderColor: c.accent }]} />
          {sensors.tilt && (
            <View
              style={[
                s.bubble,
                {
                  backgroundColor: c.accent,
                  transform: [
                    {
                      translateX: Math.max(
                        -90,
                        Math.min(90, (sensors.tilt.x - zero.x) * 5),
                      ),
                    },
                    {
                      translateY: Math.max(
                        -90,
                        Math.min(90, -(sensors.tilt.y - zero.y) * 5),
                      ),
                    },
                  ],
                },
              ]}
            />
          )}
        </View>
        <View style={s.stats}>
          {(["x", "y"] as const).map((axis) => (
            <View key={axis} style={s.flex}>
              <Label>{axis.toUpperCase()} TILT</Label>
              <Text style={[s.measure, { color: c.ink }]}>
                {sensors.tilt
                  ? `${(sensors.tilt[axis] - zero[axis]).toFixed(1)}°`
                  : "—"}
              </Text>
            </View>
          ))}
        </View>
        <Body>
          {sensors.tiltError ||
            (!sensors.tilt
              ? "Waiting for accelerometer…"
              : !sensors.tilt.flat
                ? "Lay the device flat. Large tilt reduces usefulness."
                : zero.x !== 0 || zero.y !== 0
                  ? "Relative to your reference surface."
                  : "Reference: gravity. Readings are approximate.")}
        </Body>
        <View style={s.wrap}>
          <Button
            title="Set zero"
            disabled={!sensors.tilt}
            onPress={() =>
              sensors.tilt && setZero({ x: sensors.tilt.x, y: sensors.tilt.y })
            }
            selected
          />
          <Button title="Reset" onPress={() => setZero({ x: 0, y: 0 })} />
          <Button title="Retry" onPress={sensors.retry} />
        </View>
      </>
    ),
    Angle: (
      <>
        <Text style={[s.title, { color: c.ink }]}>Measure an angle</Text>
        <Body>
          Hold the phone flat. Capture a start direction, turn, then capture the
          end. Measures the shortest signed turn, up to 180°.
        </Body>
        <View style={s.angleReadout}>
          <Text style={[s.heading, { color: c.ink }]}>
            {angle === null ? "—" : `${Math.abs(angle).toFixed(1)}°`}
          </Text>
          <Body>
            {angle === null
              ? "Ready when you are"
              : angle < 0
                ? "Counterclockwise"
                : "Clockwise"}
          </Body>
        </View>
        <Card>
          <Label>{settings.north.toUpperCase()} NORTH</Label>
          <Text style={[s.value, { color: c.ink }]}>
            Start {angleStart === null ? "—" : `${angleStart.toFixed(1)}°`} End{" "}
            {angleEnd === null ? "—" : `${angleEnd.toFixed(1)}°`}
          </Text>
        </Card>
        <Button
          title={
            angleStart === null
              ? "Capture start"
              : angleEnd === null
                ? "Capture end"
                : "Measure again"
          }
          disabled={heading === null}
          selected
          onPress={() => {
            if (heading === null) return;
            if (angleStart === null || angleEnd !== null) {
              setAngleStart(heading);
              setAngleEnd(null);
            } else setAngleEnd(heading);
          }}
        />
        <Button
          title="Reset measurement"
          onPress={() => {
            setAngleStart(null);
            setAngleEnd(null);
          }}
        />
      </>
    ),
    Settings: (
      <>
        <Text style={[s.title, { color: c.ink }]}>Settings</Text>
        <Card>
          <Label>APPEARANCE</Label>
          <Choices
            values={["system", "light", "dark"] as const}
            value={settings.theme}
            change={(v) => change("theme", v)}
          />
          <Toggle
            title="High contrast"
            value={settings.contrast}
            change={(v) => change("contrast", v)}
          />
          <Toggle
            title="Red night view"
            detail="Applies inside this app only."
            value={settings.night}
            change={(v) => change("night", v)}
          />
          <Toggle
            title="Keep screen awake"
            detail="While the app is open. Uses more battery."
            value={settings.keepAwake}
            change={(value) => change("keepAwake", value)}
          />
          <Toggle
            title="Haptic feedback"
            detail="A subtle tick at cardinal sectors."
            value={settings.haptics}
            change={(v) => change("haptics", v)}
          />
        </Card>
        <Card>
          <Label>DISTANCE UNITS</Label>
          <Choices
            values={["metric", "imperial", "nautical"] as const}
            value={settings.units}
            change={(v) => change("units", v)}
          />
          <Label>COORDINATE FORMAT</Label>
          <Choices
            values={["dd", "dms", "ddm"] as const}
            value={settings.format}
            change={(v) => change("format", v)}
          />
          <Body>
            DD: decimal degrees · DMS: degrees, minutes, seconds · DDM: degrees,
            decimal minutes
          </Body>
          <Label>NORTH REFERENCE</Label>
          <Choices
            values={["magnetic", "true"] as const}
            value={settings.north}
            change={(v) => change("north", v)}
          />
          <Body>
            True north uses the operating system’s declination-adjusted heading
            with a fresh location. Availability and calibration vary by device;
            it is not a survey instrument.
          </Body>
        </Card>
        {__DEV__ && (
          <Card>
            <Label>DEVELOPMENT / DEMO</Label>
            <Body>
              Simulated readings for emulator testing. Never mixed with real
              readings. Demo selection is not persisted.
            </Body>
            <Choices<Demo>
              values={
                ["off", "tour", "denied", "no-sensor", "no-location"] as const
              }
              value={demo}
              change={changeDemo}
            />
          </Card>
        )}
        <Card>
          <Label>SENSOR & LOCATION HELP</Label>
          <Body>{headingMessage}</Body>
          <Body>
            For true north, enable location in Places. Hold the phone face up,
            with its top edge pointing forward.
          </Body>
          <Button
            title="Retry compass"
            onPress={() => {
              sensors.retry();
              setTab("Compass");
            }}
          />
          <Label>OFF THE GRID, BY DESIGN</Label>
          <Body>
            No accounts or developer-operated backend. Settings and saved places
            live on this device. Android banners are provided by Google AdMob,
            which processes advertising and device data. We do not pass your
            coordinates, saved places, or sensor readings to ad requests.
            Instruments work offline. Device backups may include app data.
            Uninstalling may remove your places.
          </Body>
          <AdPrivacyOptions />
          <Button
            title="Calibration & sensor guidance"
            onPress={() => setCalibrate(true)}
          />
        </Card>
        <RemoveAds />
      </>
    ),
  };
  return (
    <ScreenContext.Provider
      value={{ screens, ready, storageError, notice, colors: c }}
    >
      <Theme.Provider value={c}>
        <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
          <StatusBar
            style={settings.night || c.bg === dark.bg ? "light" : "dark"}
          />
          {(tab === "Places" || tab === "Settings") && (
            <View style={s.topAd}>
              <AdBanner />
            </View>
          )}
          {tab !== "Compass" && (
            <View style={s.header}>
              <View style={s.flex}>
                <Text style={[s.appTitle, { color: c.ink }]}>
                  Field Compass
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open calibration guidance"
                onPress={() => setCalibrate(true)}
                style={[s.help, { borderColor: c.line }]}
              >
                <Text style={{ color: c.ink, fontSize: 21 }}>?</Text>
              </Pressable>
            </View>
          )}
          {demo !== "off" && (
            <View style={[s.banner, { backgroundColor: c.soft }]}>
              <Text style={{ color: c.ink, fontWeight: "700" }}>
                DEMO · {demo.toUpperCase()} · simulated readings
              </Text>
              <Button
                small
                title="Exit demo"
                onPress={() => changeDemo("off")}
              />
            </View>
          )}
          <Slot />
          <View
            style={[s.nav, { borderTopColor: c.line, backgroundColor: c.card }]}
          >
            {(["Compass", "Places", "Level", "Angle", "Settings"] as const).map(
              (v, i) => (
                <Pressable
                  key={v}
                  accessibilityRole="tab"
                  accessibilityLabel={v}
                  accessibilityState={{ selected: tab === v }}
                  onPress={() => setTab(v)}
                  style={[s.navItem, tab === v && { backgroundColor: c.soft }]}
                >
                  <Text
                    style={{
                      color: tab === v ? c.accent : c.muted,
                      fontSize: 22,
                    }}
                  >
                    {["⊕", "⚑", "⊙", "∠", "☷"][i]}
                  </Text>
                  <Text
                    style={{
                      color: tab === v ? c.ink : c.muted,
                      fontSize: 11,
                      maxWidth: "100%",
                      textAlign: "center",
                      fontWeight: "600",
                    }}
                  >
                    {v}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
          <Modal
            visible={calibrate || form || deleteId !== null}
            animationType={reduced ? "none" : "slide"}
            onRequestClose={() => {
              setCalibrate(false);
              showForm(false);
              setDeleteId(null);
            }}
          >
            <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
              <ScrollView
                contentContainerStyle={s.content}
                keyboardShouldPersistTaps="handled"
              >
                {calibrate && (
                  <>
                    <Text style={[s.title, { color: c.ink }]}>
                      A clearer bearing.
                    </Text>
                    <Card>
                      <Text style={[s.sectionTitle, { color: c.ink }]}>
                        01 / Step away
                      </Text>
                      <Body>
                        Move away from vehicles, speakers, magnets, metal
                        tables, and charging cables. Remove magnetic cases.
                      </Body>
                    </Card>
                    <Card>
                      <Text style={[s.sectionTitle, { color: c.ink }]}>
                        02 / Trace a figure eight
                      </Text>
                      <Body>
                        Move the phone slowly through a figure eight, rotating
                        it through several orientations. Then hold it flat, face
                        up, top edge forward.
                      </Body>
                    </Card>
                    <Card>
                      <Text style={[s.sectionTitle, { color: c.ink }]}>
                        03 / Check again
                      </Text>
                      <Body>
                        Compare several readings outdoors. Calibration quality
                        comes from the operating system, not a measured magnetic
                        interference detector. True north also requires a fresh
                        location.
                      </Body>
                    </Card>
                    <Body>
                      Portrait orientation is used for consistent instrument
                      axes. This app does not measure magnetic field strength or
                      promise navigation-grade accuracy.
                    </Body>
                    <Button
                      title="Back to instruments"
                      onPress={() => setCalibrate(false)}
                      selected
                    />
                  </>
                )}
                {form && (
                  <>
                    <Text style={[s.title, { color: c.ink }]}>
                      Save a place
                    </Text>
                    <Body>
                      Enter decimal degrees, using negative values for south and
                      west. Current coordinates are filled when available.
                    </Body>
                    <Label>NAME</Label>
                    <TextInput
                      accessibilityLabel="Place name"
                      placeholder="e.g. Trailhead"
                      placeholderTextColor={c.muted}
                      value={name}
                      maxLength={80}
                      onChangeText={setName}
                      style={[
                        s.input,
                        {
                          color: c.ink,
                          borderColor: c.line,
                          backgroundColor: c.card,
                        },
                      ]}
                    />
                    <Label>MARKER</Label>
                    <Choices
                      values={placeIcons}
                      value={icon}
                      change={setIcon}
                    />
                    <Label>LATITUDE (−90 TO 90)</Label>
                    <TextInput
                      accessibilityLabel="Latitude in decimal degrees"
                      value={latitude}
                      onChangeText={setLatitude}
                      keyboardType={
                        Platform.OS === "ios"
                          ? "numbers-and-punctuation"
                          : "default"
                      }
                      autoCapitalize="none"
                      style={[
                        s.input,
                        {
                          color: c.ink,
                          borderColor: c.line,
                          backgroundColor: c.card,
                        },
                      ]}
                    />
                    <Label>LONGITUDE (−180 TO 180)</Label>
                    <TextInput
                      accessibilityLabel="Longitude in decimal degrees"
                      value={longitude}
                      onChangeText={setLongitude}
                      keyboardType={
                        Platform.OS === "ios"
                          ? "numbers-and-punctuation"
                          : "default"
                      }
                      autoCapitalize="none"
                      style={[
                        s.input,
                        {
                          color: c.ink,
                          borderColor: c.line,
                          backgroundColor: c.card,
                        },
                      ]}
                    />
                    {formError !== "" && (
                      <Text accessibilityRole="alert" style={{ color: c.red }}>
                        {formError}
                      </Text>
                    )}
                    <Button
                      title="Save on this device"
                      onPress={savePlace}
                      selected
                    />
                    <Button title="Cancel" onPress={() => showForm(false)} />
                  </>
                )}
                {deleteId !== null && (
                  <>
                    <Text style={[s.title, { color: c.ink }]}>
                      Delete this place?
                    </Text>
                    <Body>
                      {state.places.find((p) => p.id === deleteId)?.name} will
                      be removed from this device.
                    </Body>
                    <Button
                      title="Delete place"
                      onPress={() => {
                        setState((v) => ({
                          ...v,
                          places: v.places.filter((p) => p.id !== deleteId),
                        }));
                        if (selectedId === deleteId) selectId(null);
                        setDeleteId(null);
                      }}
                    />
                    <Button
                      title="Keep place"
                      onPress={() => setDeleteId(null)}
                      selected
                    />
                  </>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </Theme.Provider>
    </ScreenContext.Provider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <FieldCompass />
    </SafeAreaProvider>
  );
}

const ScreenContext = createContext<{
  screens: Record<Tab, React.ReactNode>;
  ready: boolean;
  storageError: string;
  notice: string;
  colors: typeof light;
} | null>(null);
export function FieldScreen({ name }: { name: Tab }) {
  const context = useContext(ScreenContext);
  if (!context) return null;
  const { screens, ready, storageError, notice, colors } = context;
  if (name === "Compass")
    return (
      <View style={s.flex}>
        {!ready ? (
          <Body>Loading local settings…</Body>
        ) : (
          <>
            {storageError !== "" && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.red, padding: 12 }}
              >
                {storageError}
              </Text>
            )}
            {notice !== "" && (
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.ink, padding: 12 }}
              >
                {notice}
              </Text>
            )}
            {screens.Compass}
          </>
        )}
      </View>
    );
  return (
    <ScrollView
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      {!ready ? (
        <Body>Loading local settings…</Body>
      ) : (
        <>
          {storageError !== "" && (
            <Card>
              <Body color={colors.red}>{storageError}</Body>
            </Card>
          )}
          {notice !== "" && (
            <View accessibilityLiveRegion="polite">
              <Card>
                <Body color={colors.ink}>{notice}</Body>
              </Card>
            </View>
          )}
          {screens[name]}
          <Text style={[s.footer, { color: colors.muted }]}>
            KEEP YOUR BEARINGS. TAKE YOUR TIME.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
