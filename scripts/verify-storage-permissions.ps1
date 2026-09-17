param(
  [Parameter(Mandatory=$true)][string]$ApkPath,
  [Parameter(Mandatory=$true)][string]$SdkPath
)
$ErrorActionPreference = 'Stop'
$taskApk = (Resolve-Path -LiteralPath $ApkPath).Path
$taskSdk = (Resolve-Path -LiteralPath $SdkPath).Path
$taskTools = Get-ChildItem -LiteralPath (Join-Path $taskSdk 'build-tools') -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (!$taskTools) { throw 'Android build-tools are missing.' }
$taskPermissions = & (Join-Path $taskTools.FullName 'aapt.exe') dump permissions $taskApk
if ($LASTEXITCODE -ne 0) { throw 'Reading APK permissions failed.' }
if ($taskPermissions -match 'android\.permission\.(READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE)') {
  throw 'APK requests broad storage permissions. File selection must use the system document picker only.'
}
Write-Host 'APK verified: no broad storage permissions.'
