# Field Compass

An original outdoor instrument app with offline instruments. Android first, built with Expo SDK 57, React Native 0.86, TypeScript, npm, Expo Router, and plain React Native StyleSheet. No accounts, developer-operated backend, map downloads, or runtime navigation network requests. Android uses Google AdMob banners on Places and Settings; ads require network access and process advertising/device data. Local device backups are controlled by the OS.

## Android banners

Places and Settings each show one inline adaptive banner at the top of the safe area, above the app header and page title, using the same ad unit. The slot reserves 100 dp plus a label and separation so loading/failure does not move controls. Only the visible route mounts its banner. Development builds use Google's test banner ID; release builds use `ca-app-pub-6230290323057717/6085287882`. iOS and web do not request ads. The plugin's iOS app ID is Google's sample ID to keep native configuration valid; replace it with an actual iOS AdMob app ID and configure an iOS ad unit before enabling iOS advertising.

Consent is gathered through Google UMP before SDK initialization or banner requests. Measurement initialization is delayed in the Expo plugin. When required, Settings exposes **Ad privacy choices**. No coordinates, saved places, or sensor readings are supplied to the ad SDK. Failed/offline ad setup leaves instruments usable without ads.

Before distributing an ad-supported release, configure and publish applicable messages under AdMob **Privacy & messaging**, publish the revised `public/compass-privacy-policy.html` at your privacy URL, and update the Play Console ads declaration and Data safety answers for the installed Google Mobile Ads SDK. Verify consent, privacy choices, banners, offline use, and navigation on a physical Android device using test ads. Register physical test devices in AdMob before testing any release build with the production unit.

This is a native dependency change: while Gradle is idle, run `npx expo prebuild --platform android --no-install`, then rebuild/install locally with `npm run android` or `npm run build:android`. A Metro reload alone cannot add the native SDK.

## Run on Android locally

Android Settings includes a permanent **Remove ads** purchase and **Restore purchases**.
The Google Play product is `remove_ads`; configure its US price to $2.99.
Billing requires a new native build and Play Console product setup before checkout
can work. See [Remove ads setup and testing](docs/REMOVE_ADS.md).

Requirements: Node 22.13+ (Node 24 was used here), npm, Android Studio, Android SDK platform/build tools 36, NDK 27.1.12297006, and **JDK 17**. Install SDK components in Android Studio's SDK Manager. Gradle can download missing components after SDK licenses are accepted. Android Studio's bundled JDK may be newer; JDK 25 failed in native CMake tooling here.

From this directory in PowerShell:

```powershell
npm ci
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = 'C:\path\to\jdk-17'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
npm run android
```

Start an Android Virtual Device in Android Studio, or connect a phone with USB debugging first. `npm run android` generates the Android project if needed, builds locally, installs, and starts Metro. Later JS-only development can use `npm start -- --dev-client`. A local development build is required: Expo Go does not include our Android heading adapter.

For Android Studio:

```powershell
npx expo prebuild --platform android --no-install
```

Open the generated `android` directory in Android Studio. Under Settings → Build Tools → Gradle, select **JDK 17**. Start Metro with `npm start -- --dev-client`, then run the `app` configuration. The development client can open the displayed local Metro URL. No EAS account or cloud build is required.

Build an APK without launching a device:

```powershell
npm run build:android
# Only the emulator architecture, for a faster first build:
npm run build:android -- -Architectures x86_64
# Standalone JS-bundled build, runnable without Metro:
npm run build:android -- -Release
```

Release builds enable R8 full-mode code shrinking, optimization and obfuscation, plus integrated resource shrinking. `expo-build-properties` configures the release flags in `app.json`; `plugins/with-release-optimization.cjs` selects `proguard-android-optimize.txt` (the non-optimizing default disables optimization) and enables the AGP 8.12 resource pipeline. Debug builds remain unminified. After changing app configuration, run `npx expo prebuild --platform android --no-install` while Gradle is idle, then sync Android Studio. Continue using JDK 17.

For each Play upload, increase `expo.android.versionCode` in app.json. The local with-app-version config plugin makes Gradle read the saved versionCode and version directly on every sync/build, so version-only edits do not require Expo prebuild. Generate a new signed AAB after editing; an existing AAB retains its old version. Icon and other native configuration changes still require prebuild. the current release is **1.0.3 (6)**. Generate the Play bundle through Android Studio's **Generate Signed Bundle / APK → Android App Bundle → release** with your upload keystore. Command-line release builds use the generated debug signing configuration until release signing is configured, so use them for local validation only. Archive `android/app/build/outputs/mapping/release/mapping.txt` with each release to decode obfuscated crash traces. Test the optimized build on a physical phone, especially compass sensors, location permissions, saved places and sharing.

The script discovers the standard SDK path and a Gradle-cached JDK 17, or honors `ANDROID_HOME` / `JAVA_HOME`. It limits Gradle parallelism on smaller machines. Defaults to ARM64 phones and x86_64 emulators. Debug output: `android/app/build/outputs/apk/debug/app-debug.apk`; release output: `android/app/build/outputs/apk/release/app-release.apk`. Expo's generated release configuration uses the debug signing key initially: configure your own release signing before store distribution. Do not commit private signing keys.

`android/` and `ios/` are generated and ignored. Configuration lives in `app.json`; custom native code lives in `modules/field-heading`. Regenerate native projects after changing configuration/native dependencies. Keep manual native changes in a config plugin or local module so regeneration preserves them. Do not run prebuild while Gradle is building.

## Other commands

```powershell
npm run typecheck
npm run lint
npm test
npx expo-doctor
npm run web
npm run build:web
node scripts/preview.cjs
```

The last command serves the compiled web app at http://127.0.0.1:8090. Browser heading and tilt are intentionally unavailable until there is a tested browser sensor adapter. Settings → Development / Demo is available only in development builds (`npm start` / `npm run web`); production exports and native release builds do not expose simulated instruments. Browser location requires permission and a secure context (localhost qualifies). Sharing and clipboard depend on browser capabilities.

## Instruments and data honesty

- Magnetic heading works without location permission on Android. The local Kotlin module prefers the Android north-referenced fused rotation-vector sensor and reports OS calibration status. Devices without it use fresh accelerometer/magnetometer sample pairs; gravity is not filtered separately, avoiding an extra source of lag during turns. The TypeScript adapter applies circular smoothing; the dial accumulates shortest angular deltas so 359° → 0° moves one degree. Sensor silence expires headings after five seconds.
- True north is a **model estimate**: Android `GeomagneticField` supplies declination using the current location/time, evaluated offline. The OS version determines the bundled geomagnetic model and older devices can carry older models. It is not a guarantee of geographic accuracy. True headings and relative waypoint arrows require a location less than 30 seconds old; the app never silently substitutes magnetic north for true north. On iOS the adapter uses Core Location's true heading via Expo Location.
- Keep the phone face up, top edge forward. Portrait orientation is locked to make axes predictable. Android shows guidance when the phone is steeply tilted. Magnetic objects and calibration affect readings; there is no field-strength meter or interference detector.
- Altitude is labeled **WGS84 ellipsoid**, following Expo Location's contract, with reported altitude uncertainty when available. It is not labeled mean sea level. Nautical mode uses nautical miles for distances and metres for altitude. GPS estimates may be unavailable or imprecise.
- Saved-place distance is spherical great-circle distance; bearing is the initial geographic bearing, not a route or terrain-aware path. Direction is undefined within one metre of the saved coordinate. Position uncertainty may be larger than that threshold.
- Bubble level uses low-pass-filtered acceleration, displays approximate X/Y tilt, and supports a relative zero. The phone's case can bias the surface reading. Angle capture measures the shortest signed orientation difference (−180° to +180°), not accumulated multi-turn rotation.
- Permission is requested from the location action, not on launch. Level requests motion access when opened if the platform requires it. Location and sensors unsubscribe when backgrounded or when the related screens leave. No background location permission or service is enabled.
- Demo mode is explicit, non-persistent, and clearly labeled. It includes tour, permission-denied, missing-sensor, and missing-location scenarios. Demo/mock places retain their simulated label after restart and when shared. Android emulators do not supply live compass/level readings; use Demo instead. Mock location is labeled separately.
- Settings and places persist in versioned AsyncStorage. Writes are serialized; corrupted/unknown data is not overwritten with defaults. Storage errors remain visible. The active destination and measurements are session-only. Local data is not encrypted; OS backup policy may include it.

## Architecture and portability

| Area | Location | Portability |
| --- | --- | --- |
| Heading wraparound, bearing/distance, coordinate formats and units | `src/core/navigation.ts` | Pure TypeScript; any platform |
| Settings schema, saved-place creation/validation and migration boundary | `src/core/model.ts` | Pure TypeScript |
| Device, storage and user-action interfaces | `src/services/contracts.ts` | Platform independent contracts |
| Location, permissions, sensors, storage, clipboard, haptics, share | `src/services/platform.ts` | Expo/RN adapters; Android heading is custom, iOS uses Expo, browser sensors explicitly unsupported |
| Subscription ownership, app lifecycle, stale data and demo scenarios | `src/hooks/useInstruments.ts` | React + AppState; injectable service boundary for tests |
| Persistence hydration and ordered writes | `src/hooks/useSavedState.ts` | React + storage interface |
| Routes | `src/app/` | Expo Router, Android/iOS/web |
| Shared session state and instrument views | `App.tsx` | React Native; no direct native sensor access |
| Palette, primitives, dial and layout | `src/ui.tsx` | React Native/SVG, safe areas, font scaling, reduced motion |
| Android sensor fusion and declination | `modules/field-heading/` | Kotlin/Android only; autolinked local Expo module |

iOS has an Expo adapter and app configuration but needs a macOS/Xcode build plus physical sensor, permission and lifecycle verification. Web compiles and supports saved places, formatting, settings, sharing/copying where available, and demo tools. Windows/macOS require their own sensor/location adapters and native runtime setup. The pure core and most UI can be reused. Wear OS requires a separate watch app and UI, not simply a resized phone screen.

## Additional features evaluated

No unfinished feature controls are shown.

| Feature | Decision and requirements |
| --- | --- |
| UTM / MGRS / Plus Codes | Deferred from the core release. Add maintained offline encoders with published round-trip/test vectors; validate UTM zone exceptions, polar coverage, MGRS precision and Plus Code recovery rules. They can be added to the pure formatting layer without native changes. |
| Mean-sea-level altitude | Deferred. Requires a validated geoid model bundled offline, or a platform conversion with reliable availability and a labeled datum/uncertainty. Ellipsoid altitude remains the honest current value. |
| Floating Android overlay | Deferred as a separate Android capability: special overlay access, lifecycle/service ownership, persistent notification rules, explicit user opt-in and battery handling. No overlay permission is requested. |
| Wear OS | Deferred as a separate platform target with watch-specific sensor availability, power use, round-screen layout and independent installation/testing. Shared math and saved-place contracts can be reused. |

## Verification

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for performed checks and remaining device checks. Physical heading accuracy, calibration behavior, haptics, real GNSS altitude, TalkBack/font scaling and iOS hardware behavior must be checked on actual devices before release.

## Sources consulted

Original functionality reference: [Compass on Google Play](https://play.google.com/store/apps/details?id=com.balsoy.fatih.compass). Branding, dial, typography treatment, palette and implementation here are original.

- [Expo SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo SDK 57 Sensors](https://docs.expo.dev/versions/v57.0.0/sdk/sensors/)
- [Expo SDK 57 Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Expo local development builds](https://docs.expo.dev/guides/local-app-development/)
- [Android GeomagneticField](https://developer.android.com/reference/android/hardware/GeomagneticField)



### Focused compass and screen timeout

Compass is a fixed, non-scrolling instrument view. Coordinates, altitude, copying/sharing and saved-place management are in Places. Calibration guidance and Retry compass are in Settings. The normal compass view only adds a compact status action when a reading needs attention.

Settings → Keep screen awake is enabled by default and saved locally. It prevents automatic sleep while this app is active, and releases on backgrounding or when disabled. This does not change the phone's global screen-timeout preference. Device access is behind ScreenAwakeService and the Expo adapter; lifecycle handling lives in src/hooks/useScreenAwake.ts. Supported Expo native platforms can reuse this adapter; browser wake locks depend on browser support and policy.



