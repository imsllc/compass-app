# Verification record

## Automated

- TypeScript strict check: passed.
- ESLint with Expo configuration: passed.
- 21 unit/hook tests passed: heading wraparound in both directions and over multiple turns, bearing/distance including dateline and antipodal cases, DD/DMS/DDM rounding carry, unit/uncertainty conversions, place validation, storage decoding, sensor and permission failure states, app lifecycle cleanup, late subscription cleanup and stale headings.
- Persistence tests cover hydration before writing, reloadable settings/places, corrupt-data preservation and write failures.
- Expo Doctor: 21/21 checks passed.
- Production web export: passed.
- Production Android Hermes bytecode export: passed.
- npm audit (`--omit=dev`) reports 28 affected transitive packages (18 high, 10 moderate), rooted in advisories for braces, decode-uri-component, node-forge and uuid. The suggested fixes include incompatible Expo/Router major-version changes; no forced downgrade or unverified override was applied. Review upstream fixes before distribution. Expo Doctor's compatibility check is separate from this audit.

## Interactive browser checks

Checked at desktop and 390 × 844 mobile viewport:

- Original compass layout, labeled missing-sensor state, explicit demo banner.
- Saved a named/icon-marked demo trailhead; checked distance, true bearing and relative direction; selected its compass marker.
- Bubble level relative zero and angle capture. Across north, 352.9° → 16.9° captured a 24.0° clockwise turn.
- Light theme, night view, imperial units, DMS, and missing-location demo scenario.
- Expo Router navigation, permission-denied and missing-sensor demo states in the compiled production bundle; demo mode resets on reload.
- Saved places retain their simulated label after reload. Copied demo coordinates include the simulation label.

## Android

Local build uses SDK 36, NDK 27.1.12297006 and JDK 17. Android Studio's bundled JDK 25 failed in CMake configuration; JDK 17 resolves that incompatibility. Native build parallelism is limited for this machine.

- Local Gradle debug APK build: passed for ARM64 and x86_64. Verified both native ABI directories in the APK. Output: `android/app/build/outputs/apk/debug/app-debug.apk`.
- APK installed successfully on the local Android API 37 x86_64 emulator. Activity launch returned `Status: ok`; the app process remained running. No native crash appeared in the inspected AndroidRuntime logs.
- Standalone release APK: built successfully for ARM64 and x86_64, with JavaScript embedded. Installed and cold-launched on the emulator without Metro. Activity launch returned `Status: ok`, React Native logged `Running "main"`, and the app process remained running without a native or JavaScript crash in the inspected logs.
- Installable preview copy: `artifacts/field-compass-preview.apk`. It uses the generated debug signing key; production signing is still required before distribution.
- These are emulator startup smoke tests, not physical sensor accuracy checks. Full interactive tool checks were performed in the browser using labeled demo data. A physical-device offline cold launch remains to be verified.

## Still requires physical devices

- Compass axis alignment, magnetic accuracy, true-north/model behavior on different Android versions, calibration status, environmental interference, and stationary sensor liveness.
- Real permission dialogs (deny, grant approximate/precise, revoke via Settings), disabled location services, GNSS loss/staleness, and outdoor altitude/uncertainty.
- Haptics, TalkBack, large fonts, safe areas, device-specific theme behavior, screen lock and repeated foreground/background cycles.
- iOS compilation/signing on macOS, Core Location heading convention and motion permission behavior, and real iPhone/iPad sensor support.
- Signed production packaging and offline cold launch on a physical Android phone.

## Android half-turn investigation (2026-10-15)

A Pixel user reported that north did not stay fixed in the room after rotating the face-up phone by a half-turn. The observation establishes an inconsistency, but does not isolate its cause.

The Android adapter now prefers the standard north-referenced TYPE_ROTATION_VECTOR sensor (never GAME_ROTATION_VECTOR). The raw-sensor fallback pairs samples within 250 ms and no longer independently filters gravity, which could introduce lag during a turn. Both paths use the same top-edge heading extraction; true north still applies the existing geomagnetic declination model once. Near-vertical top edges are rejected, and face-down poses are no longer labeled flat.

Typecheck, lint and all 21 TypeScript tests passed. Four native JUnit tests passed: cardinal headings with tilt, half-turns, clockwise/counterclockwise north crossings, and undefined vertical headings. Physical Pixel retesting is required; these tests do not establish magnetic accuracy or prove that the reported symptom is resolved.

Retest with the updated native APK: hold the screen face up, note the physical direction of the north arrow, turn the phone 180 degrees, then wait for smoothing to settle. The heading should change approximately 180 degrees and the arrow should still point toward the same place in the room. Repeat in Magnetic mode and True mode. For an additional comparison, repeat away from the desk with the charging cable disconnected.
`nUpdated standalone ARM64/x86_64 release build passed (build-heading-fix.log). Retest APK: artifacts/field-compass-heading-fix.apk. The preview APK was also refreshed. Updated build has not yet been exercised on a physical phone.

## Fixed compass view and screen wake (2026-10-15)

The Compass route uses a fixed flex layout with a dial sized from available width and height; it has no ScrollView, header, footer, or location/place cards. The north toggle, heading/cardinal, north-reference label, dial and bottom navigation remain. A compact actionable warning appears only for unavailable/stale readings, poor calibration, or an unsuitable phone pose. Location, altitude, coordinate copy/share/save and destination details are in Places. Calibration and retry are in Settings.

Keep screen awake defaults on, persists locally, and migrates existing settings without losing places. Its Expo adapter uses a separate lock tag per acquisition. The lifecycle hook releases the lock on background, disable or unmount, including late asynchronous acquisitions. Returning to the foreground reacquires it. Turning it off restores normal system timeout behavior.

Checks: typecheck, lint, 25 TypeScript tests (including migration and wake-lock lifecycle), web export, and local ARM64/x86_64 release APK build passed. Browser checks at 390 x 844 and 320 x 568 confirmed no Compass scroll container or page overflow, correct missing-sensor state, relocated location controls and persistence of the wake setting. Demo readings remained explicitly labeled. Physical Android screen timeout, manual lock/unlock and large-font layout still require device verification. No new physical-device verification was performed for this update.

## R8 release optimization and version 1.0.1 (2) — 2026-10-16

Configured release-only minification and resource shrinking through expo-build-properties, with a local config plugin selecting proguard-android-optimize.txt and enabling R8 full mode and AGP 8.12 integrated resource shrinking. App version is 1.0.1, Android versionCode is 2, and package remains com.fieldcompass.app. npm package and lockfile versions match.

Verification: typecheck, lint and all 25 tests passed. JDK 17 Gradle :app:bundleRelease passed for arm64-v8a and x86_64, including release lint, minifyReleaseWithR8 and bundle packaging. The merged release manifest confirms the package/version values. R8 mapping identifies compiler 8.12.14; its effective configuration contains no global -dontoptimize, -dontshrink or -dontobfuscate flags. The custom FieldHeadingModule remains in the mapping (renamed to H7.e). The resulting bundle contains one valid DEX 037 file (9,224,960 bytes, 57,604 method references, 9,203 class definitions), both appmodules native ABIs, and embedded BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map. Generated seeds, usage, resources, mapping and configuration reports are archived in artifacts/release-1.0.1-2/r8-reports.zip; build output is artifacts/r8-release-build.log.

The validation AAB uses the generated debug signing configuration. Generate the Google Play upload bundle using Android Studio and the existing upload keystore. No Android device was connected; optimized-build cold launch, native compass/motion/location behavior, permission handling, persistence and sharing still require a physical-device smoke test.

## Development-only demo controls — 2026-10-16

Settings → Development / Demo is guarded by __DEV__. Release builds force the effective demo mode to off and ignore attempts to change it. Sensor-adapter messages direct production users to physical hardware or reinstall/support; emulator demo and Expo Go build instructions remain development-only. Saved demo/mock place labels and sharing disclosures are preserved.

Verification: typecheck, lint, all 25 tests, production web export, and Android :app:bundleRelease (ARM64/x86_64, R8 enabled) passed. Both compiled web JavaScript and the Hermes asset extracted from the completed AAB exclude DEVELOPMENT / DEMO, emulator demo instructions, and Expo Go build instructions, while retaining simulated saved-place labels. No physical device was connected; no device smoke test was performed. The local validation AAB still uses generated debug signing; create the Play upload with the upload keystore in Android Studio.

## Adaptive foreground padding, version 1.0.2 (4) — 2026-10-16

Matched K-Pop Piano Beats packaging: the source artwork is resized to 640 x 640 and centered at (192, 192) in the transparent 1024 x 1024 adaptive layer. Monochrome derives from the same padded layer; navy remains full bleed. The standard app icon remains the source artwork. Regenerated the preview and Android launcher resources. The color compass spans 335px within the layer (about 49% of the resting launcher viewport), versus 536px before. Updated app.json, package.json and package-lock.json to 1.0.2, Android versionCode 4.

Typecheck, lint, all 25 tests and :app:processReleaseResources passed with JDK 17. Inspected the generated xxxhdpi adaptive foreground and the circle/squircle/rounded-square/themed preview. Generated Gradle and merged release manifest show com.fieldcompass.app, versionName 1.0.2, versionCode 4. R8 configuration remains enabled. No full AAB was built for this asset update; generate a new signed bundle with the upload keystore. Installed launcher appearance has not been verified on a device.

## Direct Gradle version sync — 2026-10-17

Observed saved app.json versionCode 5 while the previous generated Android defaultConfig still specified 4. Added plugins/with-app-version.cjs to read expo.android.versionCode and expo.version directly from app.json on every Gradle configuration and apply them to defaultConfig. The plugin persists through prebuild and replaces its own marked block on repeated application. This supports Android Studio sync/build after version-only edits without a separate prebuild. Asset/native configuration changes still need normal icon generation/prebuild.

Typecheck, lint, all 25 tests and :app:processReleaseMainManifest passed. The generated release manifest confirms package com.fieldcompass.app, versionName 1.0.2, versionCode 5. No upload-signed AAB was generated; use Android Studio's signed bundle wizard and upload the newly generated file.
