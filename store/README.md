# Microsoft Store — AMSports Skunk Telemetry v6.0

This directory contains the MSIX packaging manifest for the **existing AMSports Telemetry Store listing**.

## Existing Partner Center identity (do not change for the update)
- Package identity name: `AMSPORTSTelemetry.AMSportsTelemetry`
- Publisher: `CN=FFB676D7-54C4-4A21-8C78-B6CD0EB2E799`
- Version: `6.0.0.0`
- Architecture: `x64`
- New app display name: **AMSports Skunk Telemetry**

## Build on Windows

Run in the repository root:

```powershell
python -m pip install Pillow==11.3.0
python scripts/build_v6_icon.py
dotnet publish desktop/AMSSkunkTelemetry.Desktop.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o artifacts/windows
./scripts/package-v6-store.ps1 -PublishDirectory artifacts/windows -OutputDirectory artifacts/store
```

Requires .NET 10 SDK, Python/Pillow and Windows 10/11 SDK with MakeAppx.exe.

The **AMSports v6 Microsoft Store Package** GitHub Actions workflow does these steps automatically and publishes an artifact containing:
- `AMSports-Telemetry_6.0.0.0_x64.msix`
- **`AMSports-Telemetry_6.0.0.0_x64.msixupload`** (recommended upload to Partner Center)

The MSIX uses the application's own local v6 assets, the existing Store identity, and PT/EN declared resources. It is a full-trust packaged WinForms/WebView2 .NET 10 desktop app. No secrets or credentials are embedded.

## Submit without affecting production

1. In Partner Center, open the **existing AMSports Telemetry** product and the private testing flight **Native-v5-Test** (or your intended new private flight).
2. Create a new submission for the flight and upload `AMSports-Telemetry_6.0.0.0_x64.msixupload` under Packages.
3. Review Store identity, validation results, supported devices, privacy declarations and capabilities. Test the package on Windows 10 and 11 with the **Windows App Certification Kit**.
4. Validate the iRacing, Assetto Corsa, F1, Supabase and Mobile experiences using the Store-installed package before starting the public release.
5. Only then publish the flight or main product deliberately. Nothing in this workflow uploads to Partner Center automatically.

**Signing:** MSIX submissions through the Microsoft Store are re-signed by Microsoft during publishing; the local package generated here is not a separately trusted sideload installer. Do not upload a self-signed development certificate, secret private key or obsolete Go updater keys.

**Symbols:** `.appxsym` is optional and is not currently included. Crash analytics may therefore have less detail.

**Documentation:** https://learn.microsoft.com/windows/apps/publish/publish-your-app/msix/upload-app-packages

## Compatibility and known limitations

The previous Store package identity is preserved, but this migration changes the Windows application stack to .NET and WebView2. Windows App Certification Kit, package flight installation/update from v5, and full simulator/Android tests must pass before production release.

The installed program requires the Microsoft Edge WebView2 Runtime and will store per-user application data under the permitted Windows local app-data folders. LAN Mobile streaming is disabled until explicitly enabled in Settings.
