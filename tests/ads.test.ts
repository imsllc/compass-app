import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gatherConsent: vi.fn(),
  getConsentInfo: vi.fn(),
  showPrivacyOptionsForm: vi.fn(),
  initialize: vi.fn(),
}));
vi.mock("react-native-google-mobile-ads", () => ({
  default: () => ({ initialize: mocks.initialize }),
  AdsConsent: mocks,
  AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: "REQUIRED" },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.initialize.mockResolvedValue([]);
  mocks.getConsentInfo.mockResolvedValue({
    canRequestAds: true,
    privacyOptionsRequirementStatus: "REQUIRED",
  });
});

it("waits for consent, initializes once, and shares setup between placements", async () => {
  let finish!: () => void;
  mocks.gatherConsent.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const { ads } = await import("../src/services/ads.android");
  const first = ads.prepare();
  const second = ads.prepare();
  expect(mocks.initialize).not.toHaveBeenCalled();
  expect(ads.getState().ready).toBe(false);
  finish();
  await Promise.all([first, second]);
  expect(mocks.gatherConsent).toHaveBeenCalledTimes(1);
  expect(mocks.initialize).toHaveBeenCalledTimes(1);
  expect(ads.getState()).toEqual({ ready: true, privacyRequired: true });
});

it("does not initialize or allow banners when UMP disallows requests", async () => {
  mocks.getConsentInfo.mockResolvedValue({ canRequestAds: false });
  const { ads } = await import("../src/services/ads.android");
  await ads.prepare();
  expect(mocks.initialize).not.toHaveBeenCalled();
  expect(ads.getState().ready).toBe(false);
});

it("uses previous consent after a network error without blocking instruments", async () => {
  mocks.gatherConsent.mockRejectedValue(new Error("offline"));
  const { ads } = await import("../src/services/ads.android");
  await ads.prepare();
  expect(ads.getState().ready).toBe(true);
});

it("removes banners during privacy changes and respects new eligibility", async () => {
  const { ads } = await import("../src/services/ads.android");
  await ads.prepare();
  let finish!: () => void;
  mocks.showPrivacyOptionsForm.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const changed = ads.showPrivacyOptions();
  expect(ads.getState().ready).toBe(false);
  mocks.getConsentInfo.mockResolvedValue({
    canRequestAds: false,
    privacyOptionsRequirementStatus: "REQUIRED",
  });
  finish();
  await changed;
  expect(ads.getState().ready).toBe(false);
  expect(mocks.initialize).toHaveBeenCalledTimes(1);
});

it("keeps ads disabled if consent information is unavailable", async () => {
  mocks.getConsentInfo.mockRejectedValue(new Error("unavailable"));
  const { ads } = await import("../src/services/ads.android");
  await expect(ads.prepare()).resolves.toBeUndefined();
  expect(ads.getState().ready).toBe(false);
  expect(mocks.initialize).not.toHaveBeenCalled();
});
