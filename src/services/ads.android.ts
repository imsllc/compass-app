import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
} from "react-native-google-mobile-ads";
import { AdsService, AdsState } from "./contracts";

let state: AdsState = { ready: false, privacyRequired: false };
const listeners = new Set<() => void>();
let preparation: Promise<void> | undefined;
let initialization: Promise<unknown> | undefined;

function update(next: AdsState) {
  state = next;
  listeners.forEach((listener) => listener());
}

async function refresh() {
  const info = await AdsConsent.getConsentInfo();
  const privacyRequired =
    info.privacyOptionsRequirementStatus ===
    AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  update({ ready: false, privacyRequired });
  if (!info.canRequestAds) return;
  initialization ??= mobileAds()
    .initialize()
    .catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  await initialization;
  update({ ready: true, privacyRequired });
}

export const ads: AdsService = {
  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  prepare() {
    preparation ??= (async () => {
      try {
        await AdsConsent.gatherConsent();
      } catch {
        // UMP may still allow ads using the previous session's consent.
      }
      await refresh();
    })().catch(() => {
      // Offline / consent / initialization failures must never block instruments.
      update({ ...state, ready: false });
    });
    return preparation;
  },
  async showPrivacyOptions() {
    // Remove live banners while consent changes, then check eligibility again.
    update({ ...state, ready: false });
    try {
      await AdsConsent.showPrivacyOptionsForm();
    } finally {
      await refresh();
    }
  },
};
