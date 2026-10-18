# Remove ads purchase

Settings ends with an Android-only Remove ads section. Product ID: `remove_ads`.
This is a permanent, non-consumable one-time purchase, not a subscription.
Set the US price to USD 2.99 in Play Console. Once available, the app displays
Google Play's localized price and opens Google's purchase sheet.

## First upload and product setup

1. Wait until all current Gradle builds finish. Run `npx expo prebuild --platform android --no-install`, then sync Android Studio. The `expo-iap` native module and app configuration include `com.android.vending.BILLING`.
2. Increase `expo.android.versionCode` beyond every version already uploaded. Generate a new signed release AAB with the upload keystore. Existing AABs do not gain billing support.
3. Upload that AAB to an internal testing release. Once Play recognizes billing support, create a one-time product with ID `remove_ads`, a permanent buy purchase option, and an active purchase offer. Set the US price to $2.99, configure other regions, and activate the product/option/offer as required by Play Console.
4. Use a license tester account, join the internal test, and install through Google Play. A sideloaded build alone does not establish that production billing works.

## Device verification required before rollout

- Confirm the displayed localized price and Google purchase sheet match.
- Complete a test purchase; verify both banners and their reserved space disappear.
- Relaunch offline; the cached entitlement must keep ads removed.
- Reinstall, then restore with the purchasing Play account.
- Cancel payment and test pending payment; neither may grant ad removal.
- Complete pending payment, then reopen/restore; verify acknowledgment and unlock.
- Refund/revoke the test purchase; on a subsequent successful ownership refresh
  (initial billing connection or Restore purchases), banners should return.
- Test no network, unavailable product, and an older app without the billing module.

Ownership is queried through Google Play on-device and cached separately from
settings and saved places. Transactions are acknowledged, never consumed.
Failed store queries preserve cached ownership. This app has no developer backend:
it does not perform server-side purchase-token verification or receive real-time
refund notifications. Local entitlement storage can be tampered with on a modified
device; refund changes are reconciled when the store is queried successfully.

Source: https://docs.expo.dev/guides/in-app-purchases/
