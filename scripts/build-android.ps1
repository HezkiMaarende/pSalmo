param(
  [string]$SdkPath = (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
  [string]$GradleCache = (Join-Path $env:TEMP 'psalmo-gradle'),
  [ValidateSet('arm64-v8a', 'armeabi-v7a', 'x86_64')]
  [string]$Architecture = 'arm64-v8a',
  [ValidateRange(1024, 65535)]
  [int]$MetroPort = 8081,
  [switch]$Install,
  [string]$DeviceId
)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskSdk = (Resolve-Path -LiteralPath $SdkPath).Path
$taskAdb = Join-Path $taskSdk 'platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $taskAdb)) { throw "Android platform-tools are missing: $taskSdk" }
if ($Install -and !$DeviceId) { throw 'Supply -DeviceId from adb devices before installing.' }
if (!(Get-Command java.exe -ErrorAction SilentlyContinue)) { throw 'Install a Gradle-compatible JDK first.' }
if (!(Test-Path -LiteralPath $GradleCache)) { New-Item -ItemType Directory -Path $GradleCache | Out-Null }
$taskOldSdk = $env:ANDROID_HOME
$taskOldCache = $env:GRADLE_USER_HOME
$taskOldOffline = $env:EXPO_OFFLINE
$taskOldNpmCache = $env:npm_config_cache
$taskOldAndroidUserHome = $env:ANDROID_USER_HOME
$taskOldNodeEnv = $env:NODE_ENV
Push-Location $taskRoot
try {
  $env:ANDROID_HOME = $taskSdk
  # A short cache path avoids deep Windows Gradle cache paths. No existing cache
  # or native folder is deleted; prebuild updates only generated native output.
  $env:GRADLE_USER_HOME = (Resolve-Path -LiteralPath $GradleCache).Path
  $taskAndroidUserHome = Join-Path $env:GRADLE_USER_HOME 'android-user'
  if (!(Test-Path -LiteralPath $taskAndroidUserHome)) { New-Item -ItemType Directory -Path $taskAndroidUserHome | Out-Null }
  $env:ANDROID_USER_HOME = $taskAndroidUserHome
  $env:EXPO_OFFLINE = '1'
  $env:NODE_ENV = 'development'
  $env:npm_config_cache = Join-Path $taskRoot '.npm-cache'
  & npm.cmd run generate:android
  if ($LASTEXITCODE -ne 0) { throw 'Android prebuild failed.' }
  Push-Location (Join-Path $taskRoot 'android')
  try {
    & .\gradlew.bat :app:assembleDebug --no-daemon --max-workers=2 '-Pkotlin.compiler.execution.strategy=in-process' "-PreactNativeArchitectures=$Architecture"
    if ($LASTEXITCODE -ne 0) { throw 'Native Android compilation failed. No APK success is claimed.' }
  } finally { Pop-Location }
  $taskApk = Join-Path $taskRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
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
