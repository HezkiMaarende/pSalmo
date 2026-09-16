$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskPackage = Join-Path $taskRoot 'node_modules\react-native-audio-api'
$taskDownloader = Get-Content -LiteralPath (Join-Path $taskPackage 'scripts\download-prebuilt-binaries.sh') -Raw
$taskTagMatch = [regex]::Match($taskDownloader, '(?m)^TAG="(v[0-9]+\.[0-9]+\.[0-9]+)"')
if (!$taskTagMatch.Success) { throw 'Audio API downloader release tag is not recognized. Review the upgraded dependency.' }
$taskTag = $taskTagMatch.Groups[1].Value
$taskExternal = Join-Path $taskPackage 'common\cpp\audioapi\external'
$taskAndroid = Join-Path $taskExternal 'android'
$taskComplete = Join-Path $taskPackage "android\.psalmo-audio-libs-$taskTag.complete"
if ((Test-Path -LiteralPath $taskComplete) -and (Test-Path -LiteralPath $taskAndroid)) { Write-Host "Android audio libraries $taskTag already prepared."; exit 0 }
# Match the upstream Android archive only. This app disables FFmpeg and does
# not need the upstream shell script's iOS/macOS archives or symlink cleanup.
$taskUrl = "https://github.com/software-mansion-labs/rn-audio-libs/releases/download/$taskTag/android.zip"
$taskDownloads = Join-Path $taskPackage 'android\psalmo-binaries'
if (!(Test-Path -LiteralPath $taskDownloads)) { New-Item -ItemType Directory -Path $taskDownloads | Out-Null }
if (!(Test-Path -LiteralPath $taskExternal)) { New-Item -ItemType Directory -Path $taskExternal | Out-Null }
$taskArchive = Join-Path $taskDownloads "android-$taskTag.zip"
Write-Host "Downloading official Android audio libraries: $taskUrl"
& node.exe (Join-Path $PSScriptRoot 'download-audio-archive.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Official Android audio library download failed.' }
Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256
Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskExternal -Force
if (!(Test-Path -LiteralPath $taskAndroid)) { throw 'Archive does not contain the expected Android library directory.' }
# Marker is created only after successful extraction; failed attempts retry.
New-Item -ItemType File -Path $taskComplete -Force | Out-Null
Write-Host "Prepared Android audio libraries $taskTag."
