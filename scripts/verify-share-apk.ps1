param(
  [Parameter(Mandatory=$true)][string]$ApkPath,
  [Parameter(Mandatory=$true)][string]$SdkPath,
  [Parameter(Mandatory=$true)][string]$Architectures
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility') -ErrorAction Stop
$taskApk = (Resolve-Path -LiteralPath $ApkPath).Path
$taskSdk = (Resolve-Path -LiteralPath $SdkPath).Path
$taskTools = Get-ChildItem -LiteralPath (Join-Path $taskSdk 'build-tools') -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (!$taskTools) { throw 'Android build-tools are missing.' }
$taskAapt = Join-Path $taskTools.FullName 'aapt.exe'
$taskSigner = Join-Path $taskTools.FullName 'apksigner.bat'
& $taskSigner verify --verbose $taskApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
$taskBadging = & $taskAapt dump badging $taskApk
if ($LASTEXITCODE -ne 0) { throw 'Reading the APK manifest failed.' }
if ($taskBadging -match '^application-debuggable') { throw 'Shareable APK must not be debuggable.' }
if (!($taskBadging -match "^package: name='com.paw.psalmo'")) { throw 'APK has an unexpected package ID.' }
$taskAbiLine = $taskBadging | Where-Object { $_ -match '^native-code:' }
foreach($taskAbi in $Architectures.Split(',')) {
  if (!$taskAbiLine -or $taskAbiLine -notmatch [regex]::Escape("'$taskAbi'")) { throw "APK is missing the requested architecture: $taskAbi" }
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [IO.Compression.ZipFile]::OpenRead($taskApk)
try {
  $taskBundle = $taskArchive.GetEntry('assets/index.android.bundle')
  if (!$taskBundle -or $taskBundle.Length -lt 1) { throw 'APK does not contain the standalone JavaScript/Hermes bundle.' }
  foreach($taskEntry in $taskArchive.Entries) {
    if ($taskEntry.FullName -match '(^|/)(\.env(\.[^/]*)?|credentials\.json)$|\.(jks|keystore)$') { throw 'APK includes a private configuration/signing file.' }
  }
  Write-Host "Verified signed, non-debuggable APK with embedded app bundle ($($taskBundle.Length) bytes) and requested ABIs: $Architectures"
} finally { $taskArchive.Dispose() }
