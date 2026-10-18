import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSavedState } from "../src/hooks/useSavedState";
import { defaults, makePlace } from "../src/core/model";
const mockStorage = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("../src/services/platform", () => ({ storage: mockStorage }));
let result: ReturnType<typeof useSavedState>;
let renderer: ReactTestRenderer;
function Harness() {
  const current = useSavedState();
  React.useEffect(() => {
    result = current;
  });
  return null;
}
beforeEach(() => {
  vi.resetAllMocks();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mockStorage.read.mockResolvedValue(null);
  mockStorage.write.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
it("loads local settings and saved places before writing", async () => {
  const saved = {
    ...defaults,
    settings: { ...defaults.settings, units: "nautical" },
    places: [makePlace("Camp", "△", { latitude: 1, longitude: 2 }, "demo")],
  };
  mockStorage.read.mockResolvedValue(JSON.stringify(saved));
  await act(async () => {
    renderer = create(React.createElement(Harness));
  });
  expect(result.ready).toBe(true);
  expect(result.state).toEqual(saved);
  expect(JSON.parse(mockStorage.write.mock.calls[0][0])).toEqual(saved);
  await act(async () =>
    result.setState((v) => ({
      ...v,
      settings: { ...v.settings, night: true },
    })),
  );
  expect(
    JSON.parse(mockStorage.write.mock.calls.at(-1)![0]).settings.night,
  ).toBe(true);
});
it("preserves corrupt storage without overwriting it with defaults", async () => {
  mockStorage.read.mockResolvedValue("{broken");
  await act(async () => {
    renderer = create(React.createElement(Harness));
  });
  expect(result.error).toContain("could not be loaded");
  expect(mockStorage.write).not.toHaveBeenCalled();
});
it("surfaces failed writes", async () => {
  mockStorage.write.mockRejectedValue(new Error("disk full"));
  await act(async () => {
    renderer = create(React.createElement(Harness));
  });
  expect(result.error).toContain("could not be saved");
});
