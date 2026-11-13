# Fallback when Android CLI download repeatedly fails. Uses Google's official archive.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\android-env.ps1"
$archive = Join-Path $env:LOCALAPPDATA 'PetCareUiTools\android35-google-x86_64.zip'
if ((Get-FileHash $archive -Algorithm SHA1).Hash.ToLower() -ne '0103e6dab21290c4b9d16550a3ce99476f884eef') {
    throw 'Android image SHA1 mismatch or download incomplete'
}
$parent = Join-Path $env:ANDROID_HOME 'system-images\android-35\google_apis'
New-Item -ItemType Directory -Force $parent | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $parent -Force
$avdmanager = Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\avdmanager.bat'
$existing = & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
if ($existing -notcontains 'PetCare_API_35') {
    'no' | & $avdmanager create avd --name PetCare_API_35 --package 'system-images;android-35;google_apis;x86_64' --device pixel_4
    if ($LASTEXITCODE -ne 0) { throw 'AVD creation failed' }
}
& "$env:ANDROID_HOME\emulator\emulator.exe" -accel-check
exit $LASTEXITCODE
