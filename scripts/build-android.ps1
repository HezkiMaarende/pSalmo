param(
  [string]$SdkPath = (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
  [string]$GradleCache = (Join-Path $env:TEMP 'psalmo-gradle'),
  [ValidateSet('arm64-v8a', 'armeabi-v7a', 'x86_64')]
  [string]$Architecture = 'arm64-v8a',
  [ValidateRange(1024, 65535)]
  [int]$MetroPort = 8081,
  [string]$NativeBuildParent = $env:TEMP,
  [switch]$PrepareOnly,
  [switch]$Install,
  [string]$DeviceId
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskSdk = (Resolve-Path -LiteralPath $SdkPath).Path
$taskAdb = Join-Path $taskSdk 'platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $taskAdb)) { throw "Android platform-tools are missing: $taskSdk" }
if ($Install -and !$DeviceId) { throw 'Supply -DeviceId from adb devices before installing.' }
if ($PrepareOnly -and $Install) { throw '-PrepareOnly cannot be combined with -Install.' }
if (!(Get-Command java.exe -ErrorAction SilentlyContinue)) { throw 'Install a Gradle-compatible JDK first.' }
if (!(Test-Path -LiteralPath $GradleCache)) { New-Item -ItemType Directory -Path $GradleCache | Out-Null }
$taskOldSdk = $env:ANDROID_HOME
$taskOldCache = $env:GRADLE_USER_HOME
$taskOldOffline = $env:EXPO_OFFLINE
$taskOldNpmCache = $env:npm_config_cache
$taskOldAndroidUserHome = $env:ANDROID_USER_HOME
$taskOldNodeEnv = $env:NODE_ENV
$taskNativeParent = (Resolve-Path -LiteralPath $NativeBuildParent).Path
if ($taskNativeParent.StartsWith($taskRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'NativeBuildParent must be outside the source repository.'
}
# A fresh physical copy avoids Windows Ninja's 260-character source/object path
# limit and stale CMake caches containing absolute paths. Never move or mirror
# the repository, copy its dependencies/native caches, or delete an old build.
$taskNativeRoot = Join-Path $taskNativeParent ('psn-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
if ($taskNativeRoot.Length -gt 60) { throw 'Choose a shorter -NativeBuildParent (build root must be at most 60 characters).' }
New-Item -ItemType Directory -Path $taskNativeRoot | Out-Null
$taskExcluded = @('.git', 'node_modules', 'android', 'ios', '.expo', '.cxx', '.npm-cache', '.test-build', '.gradle-native', 'artifacts', 'dist') | ForEach-Object { Join-Path $taskRoot $_ }
& robocopy.exe $taskRoot $taskNativeRoot /E /XJ /NFL /NDL /NJH /NJS /NP /R:1 /W:1 /XD $taskExcluded
if ($LASTEXITCODE -ge 8) { throw 'Copying the native-build sources failed.' }
Write-Host "Short native-build folder: $taskNativeRoot"
Write-Host 'The local .env is copied for this build only; the source repository and previous build folders are unchanged.'
Push-Location $taskNativeRoot
try {
  $env:ANDROID_HOME = $taskSdk
  # SDK/Gradle caches are reused; native CMake output is generated from scratch
  # under the short physical source path, not copied from the original folder.
  $env:GRADLE_USER_HOME = (Resolve-Path -LiteralPath $GradleCache).Path
  $taskAndroidUserHome = Join-Path $env:GRADLE_USER_HOME 'android-user'
  if (!(Test-Path -LiteralPath $taskAndroidUserHome)) { New-Item -ItemType Directory -Path $taskAndroidUserHome | Out-Null }
  $env:ANDROID_USER_HOME = $taskAndroidUserHome
  $env:EXPO_OFFLINE = '1'
  $env:NODE_ENV = 'development'
  $env:npm_config_cache = Join-Path $taskRoot '.npm-cache'
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Installing locked dependencies in the short build folder failed.' }
  & npm.cmd run generate:android
  if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
  if ($PrepareOnly) { Write-Host 'Preparation complete; no native compilation or installation was attempted.'; return }
  Push-Location (Join-Path $taskNativeRoot 'android')
  try {
    & .\gradlew.bat :app:assembleDebug --no-daemon --build-cache --max-workers=2 '-Pkotlin.compiler.execution.strategy=in-process' "-PreactNativeArchitectures=$Architecture"
    if ($LASTEXITCODE -ne 0) { throw 'Native Android compilation failed. No APK success is claimed.' }
  } finally { Pop-Location }
  $taskApk = Join-Path $taskNativeRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
  if (!(Test-Path -LiteralPath $taskApk)) { throw 'Gradle returned without the expected APK.' }
  $taskArtifacts = Join-Path $taskRoot 'artifacts'
  if (!(Test-Path -LiteralPath $taskArtifacts)) { New-Item -ItemType Directory -Path $taskArtifacts | Out-Null }
  $taskOutput = Join-Path $taskArtifacts "psalmo-development-$Architecture.apk"
  Copy-Item -LiteralPath $taskApk -Destination $taskOutput -Force
  Get-FileHash -LiteralPath $taskOutput -Algorithm SHA256
  Write-Host "Development APK: $taskOutput"
  if ($Install) {
    # Keep SDK build caches isolated, but use the user's existing USB-debugging
    # identity for adb. Never copy Expo Go tokens or replace adb authorization.
    $env:ANDROID_USER_HOME = $taskOldAndroidUserHome
    & $taskAdb -s $DeviceId get-state
    if ($LASTEXITCODE -ne 0) { throw 'The selected Android device is not authorized/available.' }
    & $taskAdb -s $DeviceId install -r $taskOutput
    if ($LASTEXITCODE -ne 0) { throw 'APK installation failed.' }
    & $taskAdb -s $DeviceId reverse "tcp:$MetroPort" "tcp:$MetroPort"
    if ($LASTEXITCODE -ne 0) { throw 'USB Metro forwarding failed.' }
    Write-Host "Run npm run start:dev -- --localhost --port $MetroPort, then open pSalmo (not Expo Go). Sign in with the same account."
  }
} finally {
  $env:ANDROID_HOME = $taskOldSdk
  $env:GRADLE_USER_HOME = $taskOldCache
  $env:EXPO_OFFLINE = $taskOldOffline
  $env:npm_config_cache = $taskOldNpmCache
  $env:ANDROID_USER_HOME = $taskOldAndroidUserHome
  $env:NODE_ENV = $taskOldNodeEnv
  Pop-Location
}
