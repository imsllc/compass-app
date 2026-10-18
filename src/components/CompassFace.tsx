import React, { useContext, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { cardinal } from "../core/navigation";
import { Choices, Dial, s, Theme } from "../ui";

export function CompassFace({
  heading,
  north,
  changeNorth,
  reduced,
  target,
  warning,
  onWarning,
}: {
  heading: number | null;
  north: "magnetic" | "true";
  changeNorth(value: "magnetic" | "true"): void;
  reduced: boolean;
  target: number | null;
  warning: string;
  onWarning(): void;
}) {
  const c = useContext(Theme);
  const [size, setSize] = useState(0);
  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        <Choices
          values={["magnetic", "true"] as const}
          value={north}
          change={changeNorth}
        />
      </View>
      <View style={styles.instrument}>
        <View style={styles.readout}>
          <Text
            maxFontSizeMultiplier={2}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[s.heading, styles.heading, { color: c.ink }]}
          >
            {heading === null ? "—" : `${Math.round(heading) % 360}°`}
          </Text>
          <Text
            maxFontSizeMultiplier={2}
            style={[s.cardinal, { color: c.accent }]}
          >
            {heading === null ? "··" : cardinal(heading)}
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={2}
          style={[s.mode, { color: c.muted, marginTop: 0 }]}
        >
          {north === "true" ? "TRUE NORTH · MODEL ESTIMATE" : "MAGNETIC NORTH"}
        </Text>
        <View
          style={styles.dial}
          onLayout={({ nativeEvent: { layout } }) =>
            setSize(Math.max(0, Math.min(layout.width, layout.height) - 20))
          }
        >
          {size > 0 && (
            <Dial
              heading={heading}
              reduced={reduced}
              target={target}
              size={size}
            />
          )}
        </View>
      </View>
      {warning !== "" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${warning} Open sensor and location settings`}
          onPress={onWarning}
          style={styles.warning}
        >
          <Text
            maxFontSizeMultiplier={2}
            numberOfLines={3}
            style={{ color: c.red, textAlign: "center", fontSize: 12 }}
          >
            {warning}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  controls: { alignItems: "center" },
  instrument: { flex: 1, justifyContent: "center", paddingTop: 12 },
  readout: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 12,
  },
  heading: { fontSize: 64, flexShrink: 1 },
  dial: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  warning: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
});
