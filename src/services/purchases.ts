import { PurchaseService, PurchaseState } from "./contracts";

const state: PurchaseState = {
  loaded: true,
  owned: false,
  busy: false,
  price: null,
  message: "",
};
export const purchases: PurchaseService = {
  getState: () => state,
  subscribe: () => () => {},
  prepare: async () => {},
  buy: async () => {},
  restore: async () => {},
};
