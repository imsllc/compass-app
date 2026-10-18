import { Point } from "../core/navigation";
export type Subscription = { remove(): void };
export type Heading = {
  magnetic: number;
  true: number | null;
  accuracy: number;
  timestamp: number;
  flat?: boolean;
};
export type Fix = Point & {
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  timestamp: number;
  mocked: boolean;
};
export type Tilt = { x: number; y: number; flat: boolean };
export type Permission = "granted" | "denied" | "undetermined";
export interface DeviceService {
  permission(request: boolean): Promise<Permission>;
  heading(callback: (heading: Heading) => void): Promise<Subscription>;
  location(
    callback: (fix: Fix) => void,
    error: (message: string) => void,
  ): Promise<Subscription>;
  tilt(callback: (tilt: Tilt) => void): Promise<Subscription>;
}
export interface StorageService {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}
export interface ScreenAwakeService {
  acquire(): Promise<Subscription>;
}
export interface ActionsService {
  copy(value: string): Promise<void>;
  share(value: string): Promise<void>;
  haptic(): Promise<void>;
}
export type AdsState = { ready: boolean; privacyRequired: boolean };
export interface AdsService {
  getState(): AdsState;
  subscribe(listener: () => void): () => void;
  prepare(): Promise<void>;
  showPrivacyOptions(): Promise<void>;
}
export type PurchaseState = {
  loaded: boolean;
  owned: boolean;
  busy: boolean;
  price: string | null;
  message: string;
};
export interface PurchaseService {
  getState(): PurchaseState;
  subscribe(listener: () => void): () => void;
  prepare(): Promise<void>;
  buy(): Promise<void>;
  restore(): Promise<void>;
}
