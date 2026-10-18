import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";
import { cardinal, normalize, unwrap } from "./core/navigation";
export const light = {
  bg: "#F3F3EA",
  card: "#FCFCF6",
  ink: "#1C302B",
  muted: "#53675F",
  line: "#CDD5C9",
  accent: "#28634C",
  soft: "#E1E9DB",
  red: "#A93829",
};
export const dark = {
  bg: "#101C18",
  card: "#192922",
  ink: "#EDF1E4",
  muted: "#B2C3B4",
  line: "#395044",
  accent: "#B8DB93",
  soft: "#2D4335",
  red: "#FFAB96",
};
export const night = {
  bg: "#100000",
  card: "#1D0505",
  ink: "#FF7770",
  muted: "#E15E57",
  line: "#6B2925",
  accent: "#FF8277",
  soft: "#390D0B",
  red: "#FF8277",
};
export const Theme = createContext(light);
const markerLabels: Record<string, string> = {
  "⌂": "Home marker",
  "△": "Mountain marker",
  "⚑": "Flag marker",
  "●": "Point marker",
  "★": "Star marker",
};
export function Label({ children }: { children: React.ReactNode }) {
  const c = useContext(Theme);
  return <Text style={[s.label, { color: c.muted }]}>{children}</Text>;
}
export function Body({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const c = useContext(Theme);
  return <Text style={[s.body, { color: color ?? c.muted }]}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  selected = false,
  disabled = false,
  small = false,
}: {
  title: string;
  onPress(): void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const c = useContext(Theme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={markerLabels[title] ?? title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        small && s.smallButton,
        {
          borderColor: c.line,
          backgroundColor: selected ? c.accent : c.card,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[s.buttonText, { color: selected ? c.bg : c.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const c = useContext(Theme);
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
      {children}
    </View>
  );
}
export function Choices<T extends string>({
  values,
  value,
  change,
}: {
  values: readonly T[];
  value: T;
  change(v: T): void;
}) {
  return (
    <View style={s.wrap}>
      {values.map((v) => (
        <Button
          key={v}
          title={v.toUpperCase()}
          selected={value === v}
          onPress={() => change(v)}
          small
        />
      ))}
    </View>
  );
}
export function Toggle({
  title,
  detail,
  value,
  change,
}: {
  title: string;
  detail?: string;
  value: boolean;
  change(v: boolean): void;
}) {
  const c = useContext(Theme);
  return (
    <View style={s.settingRow}>
      <View style={s.flex}>
        <Text style={[s.settingTitle, { color: c.ink }]}>{title}</Text>
        {detail && <Body>{detail}</Body>}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={change}
        trackColor={{ false: c.line, true: c.accent }}
        thumbColor={c.card}
      />
    </View>
  );
}
export function Dial({
  heading,
  reduced,
  target,
  size: requestedSize,
}: {
  heading: number | null;
  reduced: boolean;
  target: number | null;
  size?: number;
}) {
  const c = useContext(Theme);
  const { width } = useWindowDimensions();
  const size = requestedSize ?? Math.min(width - 56, 350);
  const [rotation] = useState(() => new Animated.Value(0));
  const continuous = useRef<number | null>(null);
  useEffect(() => {
    if (heading === null) {
      continuous.current = null;
      rotation.setValue(0);
      return;
    }
    const first = continuous.current === null;
    continuous.current = first ? heading : unwrap(continuous.current!, heading);
    const animation = Animated.timing(rotation, {
      toValue: -continuous.current,
      duration: reduced || first ? 0 : 130,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [heading, reduced, rotation]);
  const point = (deg: number, r: number) => ({
    x: 180 + Math.sin((deg * Math.PI) / 180) * r,
    y: 180 - Math.cos((deg * Math.PI) / 180) * r,
  });
  return (
    <View
      style={{
        width: size,
        height: size,
        alignSelf: "center",
        marginVertical: requestedSize === undefined ? 18 : 0,
      }}
      accessibilityLabel={
        heading === null
          ? "Compass awaiting heading"
          : `Heading ${Math.round(normalize(heading)) % 360} degrees ${cardinal(heading)}`
      }
      accessibilityRole="image"
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: heading === null ? 0.35 : 1,
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [-360, 360],
                outputRange: ["-360deg", "360deg"],
                extrapolate: "extend",
              }),
            },
          ],
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 360 360">
          <Circle cx="180" cy="180" r="174" fill={c.card} stroke={c.line} />
          <Circle
            cx="180"
            cy="180"
            r="130"
            fill="none"
            stroke={c.line}
            strokeDasharray="2 7"
          />
          {Array.from({ length: 72 }, (_, i) => {
            const a = point(i * 5, i % 6 === 0 ? 143 : i % 2 === 0 ? 153 : 158);
            const b = point(i * 5, 166);
            return (
              <Line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={i === 0 ? c.red : c.muted}
                strokeWidth={i % 6 === 0 ? 2 : 1}
              />
            );
          })}
          {["N", "E", "S", "W"].map((v, i) => {
            const p = point(i * 90, 112);
            return (
              <SvgText
                key={v}
                x={p.x}
                y={p.y + 7}
                textAnchor="middle"
                fontSize="23"
                fontWeight="600"
                fill={i === 0 ? c.red : c.ink}
              >
                {v}
              </SvgText>
            );
          })}
          {[30, 60, 120, 150, 210, 240, 300, 330].map((v) => {
            const p = point(v, 112);
            return (
              <SvgText
                key={v}
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="11"
                fill={c.muted}
              >
                {v}
              </SvgText>
            );
          })}
          <Polygon points="180,88 191,180 180,166 169,180" fill={c.red} />
          <Polygon points="180,272 191,180 180,194 169,180" fill={c.line} />
          <Circle cx="180" cy="180" r="6" fill={c.ink} />
          {target !== null &&
            (() => {
              const p = point(target, 139);
              return (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r="7"
                  fill={c.accent}
                  stroke={c.card}
                  strokeWidth="2"
                />
              );
            })()}
        </Svg>
      </Animated.View>
      <View
        pointerEvents="none"
        style={[s.index, { borderTopColor: c.accent }]}
      />
    </View>
  );
}
export const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topAd: { paddingHorizontal: 24 },
  header: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appTitle: {
    fontSize: 23,
    fontWeight: "600",
    letterSpacing: -0.8,
    marginTop: 4,
  },
  help: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 24,
    paddingTop: 12,
    gap: 16,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingBottom: 32,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    lineHeight: 17,
  },
  body: { fontSize: 14, lineHeight: 22, flexShrink: 1 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  wrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButton: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 44 },
  buttonText: { fontSize: 13, fontWeight: "600" },
  headingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 8,
  },
  heading: {
    fontSize: 76,
    fontWeight: "300",
    letterSpacing: -4,
    fontVariant: ["tabular-nums"],
  },
  cardinal: { fontSize: 26, fontWeight: "500" },
  mode: {
    textAlign: "center",
    fontSize: 10,
    letterSpacing: 1.8,
    marginTop: -5,
  },
  index: {
    position: "absolute",
    top: -6,
    left: "50%",
    marginLeft: -7,
    borderTopWidth: 15,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  card: { padding: 20, borderRadius: 18, borderWidth: 1, gap: 14 },
  coordinate: {
    fontSize: 22,
    lineHeight: 33,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.4,
  },
  stats: { flexDirection: "row", gap: 18, paddingVertical: 8 },
  value: { fontSize: 21, marginTop: 6, fontVariant: ["tabular-nums"] },
  status: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingRight: 16,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontSize: 21, fontWeight: "500", letterSpacing: -0.4 },
  title: { fontSize: 36, fontWeight: "400", letterSpacing: -1.2 },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
  },
  navItem: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 12,
    paddingVertical: 6,
  },
  footer: {
    textAlign: "center",
    fontSize: 9,
    letterSpacing: 2,
    paddingTop: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  settingTitle: { fontSize: 16, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    minHeight: 54,
  },
  banner: { padding: 12, gap: 8, alignItems: "center" },
  level: {
    width: 264,
    height: 264,
    borderRadius: 132,
    borderWidth: 2,
    alignSelf: "center",
    marginVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  crossH: { position: "absolute", width: "100%", height: 1 },
  crossV: { position: "absolute", height: "100%", width: 1 },
  levelRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 1 },
  bubble: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
    opacity: 0.75,
  },
  measure: { fontSize: 37, fontWeight: "300", fontVariant: ["tabular-nums"] },
  angleReadout: { alignItems: "center", paddingVertical: 45 },
});
