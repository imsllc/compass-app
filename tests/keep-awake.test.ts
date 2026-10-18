import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useScreenAwake } from "../src/hooks/useScreenAwake";
import { Subscription } from "../src/services/contracts";

const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
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
vi.mock("../src/services/platform", () => ({ screenAwake: mocks }));
function Harness({ enabled }: { enabled: boolean }) {
  useScreenAwake(enabled);
  return null;
}
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.resetAllMocks();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

it("releases in background, reacquires in foreground, and releases when disabled", async () => {
  const remove = vi.fn();
  mocks.acquire.mockResolvedValue({ remove });
  await act(async () => {
    renderer = create(React.createElement(Harness, { enabled: true }));
  });
  expect(mocks.acquire).toHaveBeenCalledTimes(1);
  await act(async () => mocks.onState?.("background"));
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => mocks.onState?.("active"));
  expect(mocks.acquire).toHaveBeenCalledTimes(2);
  await act(async () =>
    renderer.update(React.createElement(Harness, { enabled: false })),
  );
  expect(remove).toHaveBeenCalledTimes(2);
});

it("releases a late lock if the app backgrounds before acquisition completes", async () => {
  let resolve!: (subscription: Subscription) => void;
  mocks.acquire.mockReturnValue(
    new Promise<Subscription>((done) => {
      resolve = done;
    }),
  );
  await act(async () => {
    renderer = create(React.createElement(Harness, { enabled: true }));
  });
  await act(async () => mocks.onState?.("background"));
  const remove = vi.fn();
  await act(async () => resolve({ remove }));
  expect(remove).toHaveBeenCalledTimes(1);
});

it("does not acquire when disabled", async () => {
  await act(async () => {
    renderer = create(React.createElement(Harness, { enabled: false }));
  });
  expect(mocks.acquire).not.toHaveBeenCalled();
});
