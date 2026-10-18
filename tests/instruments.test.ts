import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Demo, useInstruments } from "../src/hooks/useInstruments";
import { Heading } from "../src/services/contracts";

const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  heading: vi.fn(),
  location: vi.fn(),
  tilt: vi.fn(),
  onState: null as null | ((state: string) => void),
}));
vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_event: string, callback: (state: string) => void) => {
      mocks.onState = callback;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock("../src/services/platform", () => ({ device: mocks }));
let result: ReturnType<typeof useInstruments>;
function Harness({
  tab = "Compass",
  demo = "off",
}: {
  tab?: string;
  demo?: Demo;
}) {
  const current = useInstruments(tab, demo);
  React.useEffect(() => {
    result = current;
  });
  return null;
}
let renderer: ReactTestRenderer;
async function mount(props = {}) {
  await act(async () => {
    renderer = create(React.createElement(Harness, props));
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.permission.mockResolvedValue("undetermined");
  mocks.heading.mockResolvedValue({ remove: vi.fn() });
  mocks.location.mockResolvedValue({ remove: vi.fn() });
  mocks.tilt.mockResolvedValue({ remove: vi.fn() });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});
describe("instrument lifecycle and failure states", () => {
  it("does not request permission or location until the related feature is used", async () => {
    await mount();
    expect(mocks.permission).toHaveBeenCalledWith(false);
    expect(mocks.location).not.toHaveBeenCalled();
    mocks.permission.mockResolvedValue("denied");
    await act(async () => result.requestLocation());
    expect(mocks.permission).toHaveBeenCalledWith(true);
    expect(result.permission).toBe("denied");
    expect(result.fix).toBeNull();
    expect(mocks.location).not.toHaveBeenCalled();
  });
  it("reports missing sensors without inventing a heading", async () => {
    mocks.heading.mockRejectedValue(new Error("Compass sensor unavailable."));
    await mount();
    expect(result.heading).toBeNull();
    expect(result.headingError).toContain("unavailable");
  });
  it("reports unavailable location and retains magnetic compass service", async () => {
    mocks.permission.mockResolvedValue("granted");
    mocks.location.mockRejectedValue(new Error("Location services are off."));
    await mount();
    expect(result.fix).toBeNull();
    expect(result.locationError).toContain("off");
    expect(mocks.heading).toHaveBeenCalled();
  });
  it("cleans up subscriptions on tool changes and background transitions", async () => {
    const removeHeading = vi.fn(),
      removeLocation = vi.fn(),
      removeTilt = vi.fn();
    mocks.permission.mockResolvedValue("granted");
    mocks.heading.mockResolvedValue({ remove: removeHeading });
    mocks.location.mockResolvedValue({ remove: removeLocation });
    mocks.tilt.mockResolvedValue({ remove: removeTilt });
    await mount();
    await act(async () => {
      renderer.update(React.createElement(Harness, { tab: "Level" }));
    });
    expect(removeHeading).toHaveBeenCalled();
    expect(removeLocation).toHaveBeenCalled();
    expect(mocks.tilt).toHaveBeenCalled();
    await act(async () => mocks.onState?.("background"));
    expect(removeTilt).toHaveBeenCalled();
    expect(result.tilt).toBeNull();
    await act(async () => mocks.onState?.("active"));
    expect(mocks.tilt).toHaveBeenCalledTimes(2);
  });
  it("removes a subscription that resolves after the screen has left", async () => {
    const remove = vi.fn();
    let resolve!: (s: { remove(): void }) => void;
    mocks.heading.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    await mount();
    await act(async () =>
      renderer.update(React.createElement(Harness, { tab: "Settings" })),
    );
    await act(async () => resolve({ remove }));
    expect(remove).toHaveBeenCalledOnce();
  });
  it("marks readings stale and suppresses subscriptions in demo mode", async () => {
    vi.useFakeTimers();
    let update!: (h: Heading) => void;
    mocks.heading.mockImplementation(async (callback) => {
      update = callback;
      return { remove: vi.fn() };
    });
    await mount();
    await act(async () =>
      update({ magnetic: 359, true: null, accuracy: 2, timestamp: Date.now() }),
    );
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(result.staleHeading).toBe(true);
    await act(async () =>
      renderer.update(React.createElement(Harness, { demo: "no-sensor" })),
    );
    expect(result.heading).toBeNull();
    expect(result.headingError).toContain("Demo:");
    expect(result.fix?.mocked).toBe(true);
  });
});
