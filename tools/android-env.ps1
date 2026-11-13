# Dot-source before Expo/adb usage: . .\tools\android-env.ps1
$petCareTools = Join-Path $env:LOCALAPPDATA 'PetCareUiTools'
$env:ANDROID_HOME = Join-Path $petCareTools 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$petCareJdk = Get-ChildItem (Join-Path $petCareTools 'jdk') -Directory -ErrorAction Stop | Select-Object -First 1
$env:JAVA_HOME = $petCareJdk.FullName
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:PATH"
Write-Host "Android SDK: $env:ANDROID_HOME"
Write-Host "Java: $env:JAVA_HOME"
