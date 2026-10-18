const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withAppVersion(config) {
  return withAppBuildGradle(config, (mod) => {
    const start = "// @generated begin field-compass-app-version";
    const end = "// @generated end field-compass-app-version";
    const block = `${start}
// Read the saved app.json on every Gradle sync/build, including signed bundles.
def fieldCompassVersion = new groovy.json.JsonSlurper().parse(rootProject.file("../app.json")).expo
def fieldCompassVersionCode = fieldCompassVersion.android.versionCode
if (!(fieldCompassVersionCode instanceof Number) ||
    fieldCompassVersionCode.intValue() != fieldCompassVersionCode ||
    fieldCompassVersionCode.intValue() < 1) {
    throw new GradleException("app.json: expo.android.versionCode must be a positive integer")
}
android.defaultConfig {
    versionCode fieldCompassVersionCode.intValue()
    versionName fieldCompassVersion.version.toString()
}
${end}`;
    const contents = mod.modResults.contents;
    const from = contents.indexOf(start);
    const to = contents.indexOf(end);
    if (from >= 0 && to < from) {
      throw new Error("Incomplete Field Compass version configuration in Android Gradle file.");
    }
    mod.modResults.contents = from >= 0
      ? contents.slice(0, from) + block + contents.slice(to + end.length)
      : contents.trimEnd() + "\n\n" + block + "\n";
    return mod;
  });
};
