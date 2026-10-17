# Generates a Microsoft Store upload package for the existing AMSports Telemetry listing.
# Store takes care of final signing. This output is not intended for sideloading.
param(
  [string]$PublishDirectory = "artifacts/windows",
  [string]$OutputDirectory = "artifacts/store"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$publish = (Resolve-Path $PublishDirectory).Path
if (-not (Test-Path (Join-Path $publish "AMS.Skunk.Telemetry.exe"))) {
    throw "Desktop executable missing. Run dotnet publish first."
}
[xml]$manifest = Get-Content "store/AppxManifest.xml" -Raw
if ($manifest.Package.Identity.Name -ne "AMSPORTSTelemetry.AMSportsTelemetry") {
    throw "Store Package/Identity Name differs from existing AMSports Partner Center listing."
}
if ($manifest.Package.Identity.Publisher -ne "CN=FFB676D7-54C4-4A21-8C78-B6CD0EB2E799") {
    throw "Publisher identity differs from existing AMSports Partner Center listing."
}
if ($manifest.Package.Identity.Version -ne "6.0.0.0") { throw "Expected Store version 6.0.0.0." }

python scripts/build_store_assets.py
$out = Join-Path $root $OutputDirectory
New-Item -Path $out -ItemType Directory -Force | Out-Null
$stage = Join-Path $env:RUNNER_TEMP "ams-store-v6"
if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) { $stage = Join-Path $out "stage" }
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item $stage -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path $publish "*") -Destination $stage -Recurse -Force
Copy-Item -Path "store/AppxManifest.xml" -Destination (Join-Path $stage "AppxManifest.xml")
New-Item -Path (Join-Path $stage "Assets") -ItemType Directory -Force | Out-Null
Copy-Item -Path "store/assets/*.png" -Destination (Join-Path $stage "Assets")
$tool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Filter MakeAppx.exe -File -Recurse |
        Where-Object { $_.FullName -match '\\x64\\' } |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $tool) { throw "Windows 10/11 SDK MakeAppx.exe (x64) was not found." }
$msixName = "AMSports-Telemetry_6.0.0.0_x64.msix"
$msix = Join-Path $out $msixName
if (Test-Path $msix) { Remove-Item $msix -Force }
& $tool pack /d $stage /p $msix /o
if ($LASTEXITCODE -ne 0) { throw "MakeAppx pack failed ($LASTEXITCODE)" }
if (-not (Test-Path $msix)) { throw "MSIX was not created." }

# Reopen and verify package layout before wrapping.
$verified = Join-Path $out "verified"
if (Test-Path $verified) { Remove-Item $verified -Recurse -Force }
& $tool unpack /p $msix /d $verified /o
if ($LASTEXITCODE -ne 0) { throw "MakeAppx unpack verification failed." }
foreach ($required in @("AppxManifest.xml", "AMS.Skunk.Telemetry.exe",
            "Assets\Square150x150Logo.png","Assets\Square44x44Logo.png",
            "wwwroot\index.html", "wwwroot\desktop\ams-v6-desktop.js")) {
    if (-not (Test-Path (Join-Path $verified $required))) {
       throw "Store payload missing required component: $required"
    }
}
Remove-Item $verified -Recurse -Force

# Recommended Store upload wrapper. Symbols may be added as .appxsym later.
$wrap = Join-Path $out "upload"
if (Test-Path $wrap) { Remove-Item $wrap -Recurse -Force }
New-Item $wrap -ItemType Directory | Out-Null
Copy-Item $msix -Destination $wrap
$upload = Join-Path $out "AMSports-Telemetry_6.0.0.0_x64.msixupload"
if (Test-Path $upload) { Remove-Item $upload -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($wrap, $upload)
Remove-Item $wrap -Recurse -Force
Write-Host "Store package: $msix"
Write-Host "Store submission upload: $upload"
Write-Host "Identity: $($manifest.Package.Identity.Name), version: $($manifest.Package.Identity.Version)"
