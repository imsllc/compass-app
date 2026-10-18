import { describe, expect, it } from "vitest";
import {
  angularDelta,
  bearing,
  cardinal,
  coordinate,
  distance,
  formatAltitude,
  formatDistance,
  formatUncertainty,
  normalize,
  unwrap,
} from "../src/core/navigation";
import { decodeState, defaults, makePlace } from "../src/core/model";
describe("headings", () => {
  it("crosses north using the shortest turn in both directions", () => {
    expect(angularDelta(359, 0)).toBe(1);
    expect(angularDelta(0, 359)).toBe(-1);
    expect(unwrap(359, 1)).toBe(361);
    expect(unwrap(1, 359)).toBe(-1);
    expect(unwrap(1080 + 359, 1)).toBe(1441);
  });
  it("normalizes negative and accumulated headings", () => {
    expect(normalize(-1)).toBe(359);
    expect(normalize(1080)).toBe(0);
    expect(cardinal(359)).toBe("N");
    expect(cardinal(90)).toBe("E");
  });
  it("defines signed shortest angles including a half turn", () => {
    expect(angularDelta(10, 350)).toBe(-20);
    expect(angularDelta(0, 180)).toBe(-180);
  });
});
describe("geodesy", () => {
  it("calculates an equatorial degree and cardinal bearings", () => {
    const origin = { latitude: 0, longitude: 0 };
    expect(distance(origin, { latitude: 0, longitude: 1 })).toBeCloseTo(
      111195.08,
      1,
    );
    expect(bearing(origin, { latitude: 1, longitude: 0 })).toBe(0);
    expect(bearing(origin, { latitude: 0, longitude: 1 })).toBe(90);
    expect(bearing(origin, { latitude: -1, longitude: 0 })).toBe(180);
  });
  it("handles the dateline, coincident points, and antipodes", () => {
    const a = { latitude: 0, longitude: 179.9 },
      b = { latitude: 0, longitude: -179.9 };
    expect(distance(a, b)).toBeCloseTo(22239.016, 1);
    expect(bearing(a, b)).toBe(90);
    expect(distance(a, a)).toBe(0);
    expect(Number.isFinite(distance(a, { latitude: 0, longitude: -0.1 }))).toBe(
      true,
    );
  });
});
describe("coordinates", () => {
  it("formats hemispheres and all three formats", () => {
    expect(coordinate(-74.006, false, "dd")).toBe("74.00600° W");
    expect(coordinate(40.7128, true, "ddm")).toBe("40° 42.768′ N");
    expect(coordinate(40.7128, true, "dms")).toBe("40° 42′ 46.1″ N");
    expect(coordinate(-90, true, "dd")).toBe("90.00000° S");
  });
  it("carries rounding across degree boundaries", () => {
    expect(coordinate(12.999999999, true, "dms")).toBe("13° 0′ 0.0″ N");
    expect(coordinate(179.999999999, false, "ddm")).toBe("180° 0.000′ E");
  });
});
describe("units", () => {
  it("keeps uncertainty legible in nautical mode and at sub-metre precision", () => {
    expect(formatUncertainty(8, "nautical")).toBe("8.0 m");
    expect(formatUncertainty(0.04, "metric")).toBe("<0.1 m");
    expect(formatUncertainty(0.3048, "imperial")).toBe("1.0 ft");
  });
  it("uses exact nautical and imperial conversions", () => {
    expect(formatDistance(1852, "nautical")).toBe("1.00 nm");
    expect(formatDistance(1609.344, "imperial")).toBe("1.00 mi");
    expect(formatDistance(0.3048, "imperial")).toBe("1 ft");
    expect(formatAltitude(30.48, "imperial")).toBe("100 ft");
  });
  it("switches metric scales and retains metric altitude for nautical mode", () => {
    expect(formatDistance(999, "metric")).toBe("999 m");
    expect(formatDistance(1200, "metric")).toBe("1.20 km");
    expect(formatAltitude(100, "nautical")).toBe("100 m");
  });
});
describe("saved places and settings", () => {
  it("validates places before adding", () => {
    expect(makePlace(" Camp ", "△", { latitude: 0, longitude: 0 }).name).toBe(
      "Camp",
    );
    expect(() =>
      makePlace("Bad", "△", { latitude: NaN, longitude: 0 }),
    ).toThrow();
    expect(() => makePlace("", "△", { latitude: 0, longitude: 0 })).toThrow();
    expect(() =>
      makePlace("Bad", "△", { latitude: 91, longitude: 0 }),
    ).toThrow();
  });
  it("round trips persistent data and rejects malformed data", () => {
    expect(decodeState(JSON.stringify(defaults))).toEqual(defaults);
    expect(decodeState(null)).toEqual(defaults);
    expect(() => decodeState("{")).toThrow();
    expect(
      decodeState(
        JSON.stringify({
          version: 1,
          settings: { theme: "unknown" },
          places: [{ latitude: 999 }],
        }),
      ).places,
    ).toEqual([]);
  });
});

it("migrates existing settings to keep awake by default and preserves opting out", () => {
  const old = { version: 1, settings: {}, places: [] };
  expect(decodeState(JSON.stringify(old)).settings.keepAwake).toBe(true);
  expect(
    decodeState(JSON.stringify({ ...old, settings: { keepAwake: false } }))
      .settings.keepAwake,
  ).toBe(false);
});
