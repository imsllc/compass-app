import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  products: vi.fn(),
  finish: vi.fn(),
  request: vi.fn(),
  updated: vi.fn(),
  errors: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: mocks.read, setItem: mocks.write },
}));
vi.mock("expo-iap", () => ({
  initConnection: mocks.connect,
  getAvailablePurchases: mocks.query,
  fetchProducts: mocks.products,
  finishTransaction: mocks.finish,
  requestPurchase: mocks.request,
  purchaseUpdatedListener: mocks.updated,
  purchaseErrorListener: mocks.errors,
}));
const purchase = {
  productId: "remove_ads",
  purchaseState: "purchased",
  purchaseToken: "test-token",
};
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(null);
  mocks.write.mockResolvedValue(undefined);
  mocks.connect.mockResolvedValue(true);
  mocks.query.mockResolvedValue([]);
  mocks.products.mockResolvedValue([
    { id: "remove_ads", displayPrice: "$2.99" },
  ]);
  mocks.finish.mockResolvedValue(undefined);
});
async function service() {
  return (await import("../src/services/purchases.android")).purchases;
}
it("restores and acknowledges a permanent purchase without consuming it", async () => {
  mocks.query.mockResolvedValue([purchase]);
  const billing = await service();
  await billing.prepare();
  expect(billing.getState().owned).toBe(true);
  expect(mocks.finish).toHaveBeenCalledWith({ purchase, isConsumable: false });
});
it("does not unlock or acknowledge pending payments", async () => {
  const billing = await service();
  await billing.prepare();
  mocks.updated.mock.calls[0][0]({ ...purchase, purchaseState: "pending" });
  await vi.waitFor(() =>
    expect(billing.getState().message).toContain("pending"),
  );
  expect(billing.getState().owned).toBe(false);
  expect(mocks.finish).not.toHaveBeenCalled();
});
it("preserves offline cached ownership when Play cannot connect", async () => {
  mocks.read.mockResolvedValue("owned");
  mocks.connect.mockRejectedValue(new Error("offline"));
  const billing = await service();
  await billing.prepare();
  expect(billing.getState()).toMatchObject({ owned: true, loaded: true });
  expect(mocks.write).not.toHaveBeenCalled();
});
it("clears cached entitlement after a successful query finds no purchase", async () => {
  mocks.read.mockResolvedValue("owned");
  const billing = await service();
  await billing.prepare();
  expect(billing.getState().owned).toBe(false);
});
it("does not grant ownership when acknowledgment fails", async () => {
  const billing = await service();
  await billing.prepare();
  mocks.finish.mockRejectedValue(new Error("failed"));
  mocks.updated.mock.calls[0][0](purchase);
  await vi.waitFor(() =>
    expect(billing.getState().message).toContain("confirmation failed"),
  );
  expect(billing.getState().owned).toBe(false);
});
it("prevents duplicate checkout requests and recovers after cancellation", async () => {
  const billing = await service();
  await billing.prepare();
  await billing.buy();
  await billing.buy();
  expect(mocks.request).toHaveBeenCalledTimes(1);
  mocks.errors.mock.calls[0][0]({ code: "user-cancelled" });
  expect(billing.getState().busy).toBe(false);
  expect(billing.getState().owned).toBe(false);
});
