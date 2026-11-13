# Start the PetCare Android device on an 8GB host.
# Android 35 enforces a 2560MB minimum even when a lower -memory value is requested.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\android-env.ps1"
& (Join-Path $env:ANDROID_HOME 'emulator\emulator.exe') -avd PetCare_API_35 -memory 2560 -cores 2 -gpu auto -no-snapshot -no-boot-anim
exit $LASTEXITCODE
