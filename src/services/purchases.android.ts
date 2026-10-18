import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Purchase } from "expo-iap";
import { PurchaseService, PurchaseState } from "./contracts";

export const REMOVE_ADS_PRODUCT = "remove_ads";
const CACHE_KEY = "field-compass.remove-ads.v1";
let state: PurchaseState = {
  loaded: false,
  owned: false,
  busy: false,
  price: null,
  message: "",
};
const listeners = new Set<() => void>();
let preparation: Promise<void> | undefined;
let store: typeof import("expo-iap") | undefined;
let listening = false;
let handling: Promise<void> = Promise.resolve();

function update(patch: Partial<PurchaseState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
async function saveOwnership(owned: boolean) {
  update({ owned });
  try {
    await AsyncStorage.setItem(CACHE_KEY, owned ? "owned" : "not-owned");
  } catch {
    update({
      message:
        "Purchase status could not be saved. Use Restore purchases if ads return after restarting.",
    });
  }
}
async function accept(purchase: Purchase) {
  if (purchase.productId !== REMOVE_ADS_PRODUCT) return;
  if (purchase.purchaseState !== "purchased" || !purchase.purchaseToken) {
    update({
      busy: false,
      message:
        "Payment is pending. Ads will be removed after Google Play confirms payment.",
    });
    return;
  }
  // Google Play supplies ownership on-device. Never consume this permanent product.
  if (!("isAcknowledgedAndroid" in purchase && purchase.isAcknowledgedAndroid)) {
    await store!.finishTransaction({ purchase, isConsumable: false });
  }
  update({ busy: false, message: "Ads removed. Thank you!" });
  await saveOwnership(true);
}
function enqueue(purchase: Purchase) {
  handling = handling
    .then(() => accept(purchase))
    .catch(() => {
      update({
        busy: false,
        message:
          "Purchase confirmation failed. Try Restore purchases to finish unlocking.",
      });
    });
}
async function reconcile() {
  const owned = await store!.getAvailablePurchases();
  const purchase = owned.find(
    (item) =>
      item.productId === REMOVE_ADS_PRODUCT &&
      item.purchaseState === "purchased" &&
      item.purchaseToken,
  );
  if (purchase) await accept(purchase);
  else await saveOwnership(false);
}
async function prepare() {
  preparation ??= (async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      update({ owned: cached === "owned" });
    } catch {
      update({
        message: "Saved purchase status is unavailable. Try Restore purchases.",
      });
    } finally {
      update({ loaded: true });
    }
    store = await import("expo-iap");
    if (!listening) {
      store.purchaseUpdatedListener(enqueue);
      store.purchaseErrorListener((error) => {
        update({
          busy: false,
          message:
            error.code === "user-cancelled"
              ? "Purchase cancelled."
              : "Google Play could not complete the purchase. Please try again.",
        });
      });
      listening = true;
    }
    if (!(await store.initConnection())) throw new Error("Billing unavailable");
    await reconcile();
    const products = await store.fetchProducts({
      skus: [REMOVE_ADS_PRODUCT],
      type: "in-app",
    });
    const product = products?.find((item) => item.id === REMOVE_ADS_PRODUCT);
    update({ price: product?.displayPrice ?? null });
    if (!product && !state.owned) {
      update({
        message: "Purchase is currently unavailable. Please try again later.",
      });
      preparation = undefined;
    }
  })().catch(() => {
    preparation = undefined;
    update({
      loaded: true,
      busy: false,
      message:
        "Google Play purchases are unavailable. Check your connection and try again.",
    });
  });
  await preparation;
}
export const purchases: PurchaseService = {
  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  prepare,
  async buy() {
    if (state.busy || state.owned) return;
    update({ busy: true, message: "" });
    await prepare();
    if (!state.price || !store || state.owned) {
      update({ busy: false });
      return;
    }
    try {
      await store.requestPurchase({
        request: { google: { skus: [REMOVE_ADS_PRODUCT] } },
        type: "in-app",
      });
      // Completion arrives through the app-owned purchase listener.
    } catch {
      update({
        busy: false,
        message: "Purchase could not start. Please try again.",
      });
    }
  },
  async restore() {
    if (state.busy) return;
    update({ busy: true, message: "" });
    await prepare();
    try {
      if (!store || !preparation) throw new Error("Billing unavailable");
      await reconcile();
      update({
        message: state.owned
          ? "Purchase restored. Ads are removed."
          : "No completed Remove ads purchase was found for this Google Play account.",
      });
    } catch {
      update({
        message:
          "Purchases could not be restored. Check your connection and try again.",
      });
    } finally {
      update({ busy: false });
    }
  },
};
