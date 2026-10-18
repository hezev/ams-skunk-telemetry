# AMSports Skunk Telemetry Windows 6.0.1 — track discovery and cloud lap fix

## What the 2026-10-18 test actually showed

Read-only Supabase inspection confirms:

- `ams_live_sessions` contained a recent **iRacing** sample today. The circuit field was populated but the car field was **empty**.
- `ams_laps` had no new completed laps after **2026-10-16 20:45 UTC** at the time of inspection.
- `ams_laps` RLS permits **INSERT** and **SELECT** by the owning pilot, **not UPDATE**. The v6.0 client was incorrectly using `resolution=merge-duplicates` (upsert) on completed lap submission.
- The v6.0 client silently rejected every lap whose own car name was empty. This matches the observed live row.

No database policies, permissions, rows, or public website have been changed.

## Changes in this hotfix

1. **Car identity**: first resolve the actual driver's `DriverCarIdx` against the iRacing `Drivers` YAML array. Only use own-driver car strings, `CarScreenName`, or `DriverCarPath` as fallback. No opponent car is fabricated.
2. **Lap persistence**: after collecting at least 20 samples and a lap time between 20 and 7200 seconds, write a JSON lap packet to `%LOCALAPPDATA%\AMS\SkunkTelemetry\PendingLaps\`. It survives app restart/offline. The outbox is scoped to the authenticated pilot and cannot sync across accounts.
3. **Cloud HTTP**: use ordinary INSERT for `ams_laps`, preserving the stable `local_lap_id` across retries. Only a verified `23505` conflict on the unique pilot/local-lap ID counts as already delivered. Leave the file in place on other errors.
4. **New tracks**: preserve iRacing YAML fields `TrackID`, `TrackName`, `TrackDisplayName`, `TrackConfigName`, `TrackLength` and `TrackType` in the first recorded sample as `_capture.metadata`. The native WebView2 bridge notifies the portal's existing `AMSTrack` search when the track/layout changes and uses ID/layout/name plus the existing GPS-reference matching; unknown maps show explicit errors instead of using an unrelated oval.
5. **Diagnostics**: print session changes, rejected laps and Supabase HTTP errors, and write cloud-sync notices to `%LOCALAPPDATA%\AMS\SkunkTelemetry\Logs\cloud.log`. Do not overwrite errors with a simulator-online notice every second.
6. **v6.0.1 / Store 6.0.1.0**: new package version so the Store update can supersede 6.0.0.0.

## Exact steps to verify

1. Install the latest Windows v6.0.1 x64 build from the **Windows Desktop Preview** GitHub Actions workflow on `feature/windows-desktop-app`. For Store flights use the distinct `6.0.1.0` MSIXUPLOAD artifact.
2. Log in to the correct AMS account **inside the Windows application**.
3. Start iRacing on a track that was not previously recognized; verify the bottom bar identifies the simulator and that the map displays `A procurar novo mapa`, an identified matching layout, or an explicit unrecognized-circuit reason. A map cannot be created from lap percentage alone; if neither vector artwork nor a compatible GPS reference exists, there is no trustworthy outline.
4. Drive more than one **valid** full lap. Watch for `Volta N (...s) guardada na fila local` and then `Volta enviada e confirmada no Supabase`. If `Supabase HTTP ...` appears, read the log.
5. In Supabase verify the new `ams_laps` rows belong to your own pilot. Check the corresponding date/time and circuit.
6. To test resilience: disconnect the Internet after logging in, complete a lap, then reconnect without changing AMS account. The lap JSON should remain pending and upload on reconnection.

### Existing v6.0 test session recovery

The full raw SDK capture from the prior build **may still be preserved locally**, even if the lap upload did not happen:

`%LOCALAPPDATA%\AMS\SkunkTelemetry\Sessions\` — `*.jsonl.gz` files.

Keep a copy of these files before uninstalling or clearing application data. v6.0.1 does not automatically convert older raw archives into cloud laps; that requires separate recovery/import validation to prevent duplicate or incorrectly labeled laps.

### Remaining limits

- Automatic matching can only find a track layout if it exists in the configured iRacing vector map catalog or an appropriate GPS reference. The native SDK's lap-percentage data are insufficient to trace unseen physical geometry.
- Simulator-specific lap completion for Assetto Corsa and F1 24/25 still requires live testing.
- Real iRacing + Supabase end-to-end lap upload is not fully verified by a successful Windows compilation. Keep this as a **test** release in the PR.
