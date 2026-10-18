# Production readiness audit — October 17, 2026

Assessment: hold public rollout until the release gates below are verified. Android is the primary target. This was a source/configuration audit with automated checks, not a physical-device certification. No application behavior was changed.

## Findings

1. **P1 — Known vulnerable URL decoder in the routing dependency chain.** `package-lock.json:4780` installs `decode-uri-component` 0.2.2 through `query-string` 7.1.3 (`package-lock.json:10050`), which Expo Router uses in its path/state parsers. The app exposes the `field-compass` URL scheme (`app.json`). The advisory describes CPU denial of service from malformed encoded input; patched version is 0.5.0. Dependency exposure is confirmed; an end-to-end malicious-link reproduction was not attempted. Resolve through an SDK-compatible dependency update or a carefully tested patch/override before release. Do not apply the audit's suggested forced Expo downgrade. Source: https://github.com/advisories/GHSA-vcc3-ghjq-m6fr

2. **P1 release gate — Command-line release artifacts use debug signing.** `android/app/build.gradle:115` selects `signingConfigs.debug` for release. `scripts/build-android.ps1` invokes that release variant without requiring upload signing. This is documented, but `npm run build:android -- -Release` does not produce a store-ready artifact. Use the existing upload keystore in Android Studio as documented, verify the resulting AAB certificate, and archive the matching mapping file. Keep a reproducible signing configuration outside generated sources if automating this workflow.

3. **P1 verification gap — Physical compass behavior remains unproven after a reported defect.** `docs/VERIFICATION.md:45` records the Pixel half-turn problem and explicitly requires physical retesting. Existing math tests and emulator startup checks cannot prove real magnetic accuracy, axes, calibration, true-north behavior, or stationary sensor liveness. Verify the current optimized release on a physical phone, including the half-turn test, offline cold start, permission revocation, GNSS loss, background/foreground cycles, TalkBack, and large fonts. iOS is separately unverified and needs macOS/Xcode plus physical iPhone testing.

4. **P2 — Bubble level can present a frozen reading as current.** `src/services/contracts.ts:17` gives Tilt no timestamp. `src/hooks/useInstruments.ts:147` retains the last tilt indefinitely while only heading/location receive stale checks at lines 178–179. `App.tsx:565` enables Set zero whenever that retained object exists. If the accelerometer stops delivering after a valid sample, the old numeric reading and bubble remain usable. Timestamp tilt samples, expire silent sensors, and disable zeroing until fresh data returns; test one valid sample followed by silence.

5. **P2 — Failed ad setup cannot recover in the same process.** `src/services/ads.android.ts:43` permanently memoizes preparation. Both a failed refresh/initialization and a successful consent response with `canRequestAds: false` leave that promise cached. Subsequent route mounts call prepare but do not retry consent/initialization. A launch during an outage can therefore suppress ads for the entire session after connectivity returns. Reset failed preparation and add a bounded foreground/user retry path without overriding a legitimate consent refusal.

6. **P2 — Privacy policy is not reachable from the app.** Settings renders an advertising explanation and the conditional UMP privacy choices control (`App.tsx:722`), but has no policy URL or contact action. The HTML policy exists only as `public/compass-privacy-policy.html`; its existence does not establish a published production URL. Add an always-visible policy link and verify that the published page matches the shipped ads/billing features. README also leaves AdMob messages and Play declarations as manual release work; account configuration was not accessible for this audit, so completion is unknown.

7. **P2 — Partially corrupt saved data is silently rewritten.** `src/core/model.ts:76` filters invalid place records and truncates the array without returning an error. `src/hooks/useSavedState.ts` then treats the decoded result as writable and immediately persists it after hydration. An otherwise parseable storage object containing one valid place and one invalid place loses the original invalid record without notice or recovery. This differs from the documented preservation guarantee for corrupt data. Validate the whole payload or retain the original and explicitly report partial recovery before overwriting it.

8. **P2 performance risk — Every sensor update rebuilds every screen and every saved-place row.** `App.tsx:291` constructs the entire screens record on every FieldCompass render, including `state.places.map` at line 459, even when Compass or Level is visible. Heading emits about every 80 ms and up to 500 places are allowed. Places uses a ScrollView rather than a virtualized list. This creates avoidable JS work and allocations during live instrument use. Move screen construction into route components, isolate sensor state, and virtualize/memoize place rows. Profile a release build with 500 places on a lower-end Android phone; no measured frame-rate regression is claimed here.

## Other observations

- App configuration says 1.0.4 (7), while package.json/package-lock.json and README still identify 1.0.3. Gradle's version plugin reads app.json, so this is release bookkeeping drift rather than proof of an incorrect APK version.
- Online Expo Doctor passes 20 of 21 checks and flags SDK patch drift: expo 57.0.29 should be ~57.0.30; expo-router 57.0.27 should be ~57.0.28. Update using Expo's installer and rerun the security/build checks; these patch recommendations alone do not establish that the decoder advisory is fixed.
- Remove ads displays a hard-coded $2.99 fallback before a store price is available (`src/components/RemoveAds.android.tsx`). Prefer an unavailable/loading label until Play returns the localized price.
- Purchases are acknowledged on-device and cached, with no server verification. This is an explicitly documented architectural tradeoff for this offline app, not a recommendation to introduce a backend. Real Play internal-test purchase/restore/pending/refund checks in `docs/REMOVE_ADS.md` remain a release gate; mock tests cannot establish product activation or billing behavior.
- The npm audit reports 29 affected dependency nodes (19 high, 10 moderate), not 29 independently proven exploitable app vulnerabilities. Other advisory roots include braces, node-forge, and uuid in build/configuration tooling. Assess their execution context separately from the runtime URL-decoder issue.

## Checks

- `npm run typecheck`: passed after web export completed. An initial concurrent run encountered an export file being replaced; a sequential rerun passed.
- `npm run lint`: passed.
- `npm test`: passed, 36 tests across 6 files.
- `npm run build:web`: passed.
- `npx expo install --check`: passed against the local SDK dependency map; remote validation was unavailable in the restricted shell.
- `npm audit --omit=dev --audit-level=high`: completed with advisories listed above.
- `npx --yes expo-doctor` with network access: 20/21 checks passed; failed SDK patch-version check as described above. The first restricted attempt could not reach npm.
- `npm run build:android -- -Release`: passed for ARM64 and x86_64 with JDK 17 and Android SDK 36, including native release lint. The merged manifest confirms 1.0.4 (7) and billing permission. Output is `android/app/build/outputs/apk/release/app-release.apk`; it uses the configured debug signing, and was not installed or exercised on a device. The first attempt could not discover SDK/JDK under the sandbox profile; the retry explicitly configured their installed paths.

## Release order

Resolve the runtime dependency issue and data/sensor failure behavior; complete signing and published-policy setup; then test the exact upload-signed release through Play internal testing on physical hardware, including billing and consent. Keep the existing local-build workflow and native module ownership.
