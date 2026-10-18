param([switch]$Release, [string]$Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'
if (-not $env:ANDROID_HOME) {
  $sdkPath = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Android\Sdk'
  if (Test-Path $sdkPath) { $env:ANDROID_HOME = $sdkPath }
}
if (-not $env:JAVA_HOME) {
  $cachedJdk = Get-ChildItem (Join-Path $env:USERPROFILE '.gradle\jdks') -Directory -ErrorAction SilentlyContinue |
    Where-Object { (Test-Path (Join-Path $_.FullName 'release')) -and (Select-String -Path (Join-Path $_.FullName 'release') -Pattern 'JAVA_VERSION="17\.' -Quiet) } |
    Select-Object -First 1
  if ($cachedJdk) { $env:JAVA_HOME = $cachedJdk.FullName }
}
if (-not $env:ANDROID_HOME -or -not $env:JAVA_HOME) { throw 'Install Android Studio, its SDK, and set ANDROID_HOME and JAVA_HOME. See README.md.' }
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
$env:CMAKE_BUILD_PARALLEL_LEVEL = '2'
if (-not (Test-Path (Join-Path $PSScriptRoot '..\android\gradlew.bat'))) {
  & npx expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Push-Location (Join-Path $PSScriptRoot '..\android')
try {
  if ($Release) { & .\gradlew.bat ':app:assembleRelease' "-PreactNativeArchitectures=$Architectures" --max-workers=2 '-Dorg.gradle.parallel=false' } else { & .\gradlew.bat ':app:assembleDebug' "-PreactNativeArchitectures=$Architectures" --max-workers=2 '-Dorg.gradle.parallel=false' }
  $buildExit = $LASTEXITCODE
} finally { Pop-Location }
exit $buildExit
