export type Point = { latitude: number; longitude: number };
export type Units = "metric" | "imperial" | "nautical";
export type CoordinateFormat = "dd" | "dms" | "ddm";
export const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;
export const angularDelta = (from: number, to: number) =>
  normalize(to - from + 180) - 180;
export const unwrap = (previous: number, next: number) =>
  previous + angularDelta(previous, next);
export const cardinal = (heading: number) =>
  ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(normalize(heading) / 45) % 8
  ];
const rad = (n: number) => (n * Math.PI) / 180;
export function distance(a: Point, b: Point) {
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return (
    6371008.8 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function bearing(a: Point, b: Point) {
  const d = rad(b.longitude - a.longitude);
  return normalize(
    (Math.atan2(
      Math.sin(d) * Math.cos(rad(b.latitude)),
      Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) -
        Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(d),
    ) *
      180) /
      Math.PI,
  );
}
export function formatDistance(meters: number, units: Units) {
  if (units === "nautical") return `${(meters / 1852).toFixed(2)} nm`;
  if (units === "imperial")
    return meters < 1609.344
      ? `${Math.round(meters / 0.3048)} ft`
      : `${(meters / 1609.344).toFixed(2)} mi`;
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2)} km`;
}
export function formatAltitude(meters: number, units: Units) {
  return units === "imperial"
    ? `${Math.round(meters / 0.3048)} ft`
    : `${Math.round(meters)} m`;
}
export function formatUncertainty(meters: number, units: Units) {
  const value = units === "imperial" ? meters / 0.3048 : meters;
  const label = units === "imperial" ? "ft" : "m";
  return `${value > 0 && value < 0.1 ? "<0.1" : value.toFixed(value < 10 ? 1 : 0)} ${label}`;
}
export function coordinate(
  value: number,
  latitude: boolean,
  format: CoordinateFormat,
) {
  const hemisphere = latitude ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  const absolute = Math.abs(value);
  if (format === "dd") return `${absolute.toFixed(5)}° ${hemisphere}`;
  // Round before splitting so seconds/minutes carry cleanly into the next degree.
  if (format === "ddm") {
    const total = Math.round(absolute * 60 * 1000) / 1000;
    return `${Math.floor(total / 60)}° ${(total % 60).toFixed(3)}′ ${hemisphere}`;
  }
  const total = Math.round(absolute * 3600 * 10) / 10;
  return `${Math.floor(total / 3600)}° ${Math.floor((total % 3600) / 60)}′ ${(total % 60).toFixed(1)}″ ${hemisphere}`;
}
export const coordinates = (p: Point, format: CoordinateFormat) =>
  `${coordinate(p.latitude, true, format)}  ${coordinate(p.longitude, false, format)}`;
export function validPoint(p: Point) {
  return (
    p != null &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
