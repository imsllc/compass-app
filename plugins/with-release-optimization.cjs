const { withAppBuildGradle, withGradleProperties } = require("expo/config-plugins");

module.exports = function withReleaseOptimization(config) {
  config = withAppBuildGradle(config, (mod) => {
    // Expo's default proguard-android.txt includes -dontoptimize. Use the
    // optimizing defaults so enabling minification actually optimizes DEX.
    const original = mod.modResults.contents;
    const updated = original.replaceAll(
      'getDefaultProguardFile("proguard-android.txt")',
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    if (!updated.includes('getDefaultProguardFile("proguard-android-optimize.txt")')) {
      throw new Error("Release optimization: could not find the Android default ProGuard configuration.");
    }
    mod.modResults.contents = updated;
    return mod;
  });
  return withGradleProperties(config, (mod) => {
    // AGP 8.12 requires explicit opt-in to integrated resource/code shrinking.
    for (const key of ["android.r8.optimizedResourceShrinking", "android.enableR8.fullMode"]) {
      mod.modResults = mod.modResults.filter((entry) => entry.key !== key);
      mod.modResults.push({ type: "property", key, value: "true" });
    }
    return mod;
  });
};
