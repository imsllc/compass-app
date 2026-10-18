import { CoordinateFormat, Point, Units, validPoint } from "./navigation";
export const placeIcons = ["⌂", "△", "⚑", "●", "★"] as const;
export type Place = Point & {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  source?: "manual" | "demo" | "mock";
};
export type Settings = {
  theme: "system" | "light" | "dark";
  contrast: boolean;
  night: boolean;
  haptics: boolean;
  keepAwake: boolean;
  units: Units;
  format: CoordinateFormat;
  north: "magnetic" | "true";
};
export type SavedState = { version: 1; settings: Settings; places: Place[] };
export const defaults: SavedState = {
  version: 1,
  settings: {
    theme: "system",
    contrast: false,
    night: false,
    haptics: false,
    keepAwake: true,
    units: "metric",
    format: "dd",
    north: "magnetic",
  },
  places: [],
};
export function makePlace(
  name: string,
  icon: string,
  point: Point,
  source: Place["source"] = "manual",
): Place {
  if (
    !name.trim() ||
    !validPoint(point) ||
    !placeIcons.includes(icon as (typeof placeIcons)[number])
  )
    throw new Error("Enter a name and valid coordinates.");
  return {
    ...point,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: name.trim().slice(0, 80),
    icon,
    createdAt: Date.now(),
    source,
  };
}
export function decodeState(raw: string | null): SavedState {
  if (!raw) return defaults;
  const parsed = JSON.parse(raw);
  if (parsed.version !== 1 || !Array.isArray(parsed.places))
    throw new Error("Unsupported saved data.");
  const s = parsed.settings ?? {};
  return {
    version: 1,
    settings: {
      theme: ["system", "light", "dark"].includes(s.theme) ? s.theme : "system",
      contrast: s.contrast === true,
      night: s.night === true,
      haptics: s.haptics === true,
      keepAwake: s.keepAwake !== false,
      units: ["metric", "imperial", "nautical"].includes(s.units)
        ? s.units
        : "metric",
      format: ["dd", "dms", "ddm"].includes(s.format) ? s.format : "dd",
      north: s.north === "true" ? "true" : "magnetic",
    },
    places: parsed.places
      .filter(
        (p: Place) =>
          validPoint(p) &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          placeIcons.includes(p.icon as (typeof placeIcons)[number]),
      )
      .slice(0, 500),
  };
}
