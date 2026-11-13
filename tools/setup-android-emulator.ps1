# Requires Android CLI/JDK under LOCALAPPDATA\PetCareUiTools.
# Android SDK licence acceptance was explicitly authorized for this setup.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\android-env.ps1"
$sdkmanager = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat'
$avdmanager = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\avdmanager.bat'
1..50 | ForEach-Object { 'y' } | & $sdkmanager "--sdk_root=$env:ANDROID_HOME" --licenses
if ($LASTEXITCODE -ne 0) { throw 'SDK license acceptance failed' }
$android = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\android.exe'
# Android CLI 1.1 uses slash-delimited package IDs; sdkmanager compatibility
# wrapper incorrectly splits legacy semicolon IDs, so install one package at a time.
foreach ($package in @('platform-tools', 'emulator', 'platforms/android-35', 'system-images/android-35/google_apis/x86_64')) {
    & $android "--sdk=$env:ANDROID_HOME" sdk install $package
    if ($LASTEXITCODE -ne 0) { throw "SDK installation failed: $package" }
}
$existing = & (Join-Path $env:ANDROID_HOME 'emulator\emulator.exe') -list-avds
if ($existing -notcontains 'PetCare_API_35') {
    'no' | & $avdmanager create avd --name PetCare_API_35 --package 'system-images;android-35;google_apis;x86_64' --device pixel_4
    if ($LASTEXITCODE -ne 0) { throw 'AVD creation failed' }
}
& (Join-Path $env:ANDROID_HOME 'emulator\emulator.exe') -accel-check
