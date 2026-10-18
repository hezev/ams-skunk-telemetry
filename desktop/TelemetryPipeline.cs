using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AMSSkunkTelemetry.Desktop;

internal static class IracingTrackIdentity
{
    internal static Dictionary<string, string> Metadata(SimSnapshot snapshot)
    {
        var info = snapshot.SessionInfo ?? "";
        var metadata = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (string key in new[] { "TrackID", "TrackName", "TrackDisplayName", "TrackConfigName", "TrackLength", "TrackType" })
        {
            var match = Regex.Match(info, @"(?m)^\s*" + Regex.Escape(key) + @":\s*(.*?)\s*$");
            if (match.Success)
            {
                var value = match.Groups[1].Value.Trim(' ', '\\r', '\\n', '"', '\\'');
                if (value.Length > 0) metadata[key] = value;
            }
        }
        if (!metadata.ContainsKey("TrackDisplayName") && !string.IsNullOrWhiteSpace(snapshot.Circuit))
            metadata["TrackDisplayName"] = snapshot.Circuit;
        return metadata;
    }
}

internal static class TelemetryFields
{
    private static double? N(IReadOnlyDictionary<string, object?> values, string key)
    {
        if (!values.TryGetValue(key, out var raw) || raw is null) return null;
        try { return Convert.ToDouble(raw); }
        catch { return null; }
    }
    private static double? Finite(double? n) => n is double v && double.IsFinite(v) ? v : null;
    private static double? Pct(double? n) => Finite(n * 100);
    private static double? Degrees(double? n) => Finite(n * (180.0 / Math.PI));
    private static double? Grav(double? n) => Finite(n / 9.80665);

    /// <summary>Campos partilhados com o site. Não confundir posição da classificação com progresso na pista.</summary>
    internal static Dictionary<string, object?> Map(SimSnapshot s)
    {
        var v = s.Channels;
        if (s.Simulator != "iRacing")
        {
            var data = new Dictionary<string, object?>
            {
                ["speed"] = N(v, "SpeedKph"),
                ["rpm"] = N(v, "RPM"),
                ["gear"] = N(v, "Gear"),
                ["throttle"] = N(v, "Throttle"),
                ["brake"] = N(v, "Brake"),
                ["steer"] = N(v, "SteerDeg"),
                ["fuel"] = N(v, "FuelLitres"),
                ["gLat"] = N(v, "LatG"),
                ["gLong"] = N(v, "LongG"),
                ["tyreFL"] = N(v, "TyreFL"), ["tyreFR"] = N(v, "TyreFR"),
                ["tyreRL"] = N(v, "TyreRL"), ["tyreRR"] = N(v, "TyreRR"),
                ["tyrePressureFL"] = N(v, "PressureFL"), ["tyrePressureFR"] = N(v, "PressureFR"),
                ["tyrePressureRL"] = N(v, "PressureRL"), ["tyrePressureRR"] = N(v, "PressureRR"),
                ["positionOverall"] = N(v, "PositionOverall"),
                ["_p"] = N(v, "LapDistPct"),
                ["trackPositionPct"] = N(v, "LapDistPct") * 100,
                ["lap"] = N(v, "Lap"),
                ["lastLap"] = N(v, "LastLapTimeMs") / 1000,
                ["airTemp"] = N(v, "AirTemp"),
                ["trackTemp"] = N(v, "TrackTemp")
            };
            return data.Where(x=>x.Value is double f && double.IsFinite(f)).ToDictionary(x=>x.Key,x=>x.Value);
        }
        double? track = N(v, "LapDistPct");
        int playerIdx = (int)(N(v, "PlayerCarIdx") ?? -1);
        var player = s.Drivers.FirstOrDefault(d => Convert.ToInt32(d["carIdx"]) == playerIdx);

        var p = new Dictionary<string, object?>
        {
            ["speed"] = Finite(N(v, "Speed") * 3.6),
            ["rpm"] = N(v, "RPM"),
            ["gear"] = N(v, "Gear"),
            ["throttle"] = Pct(N(v, "Throttle")),
            ["brake"] = Pct(N(v, "Brake")),
            ["clutch"] = Pct(N(v, "Clutch")),
            ["steer"] = Degrees(N(v, "SteeringWheelAngle")),
            ["steeringTorque"] = N(v, "SteeringWheelTorque"),
            ["gLat"] = Grav(N(v, "LatAccel")),
            ["gLong"] = Grav(N(v, "LongAccel")),
            ["fuel"] = N(v, "FuelLevel"),
            ["fuelUsePerHour"] = N(v, "FuelUsePerHour"),
            ["trackPositionPct"] = Pct(track),
            ["_p"] = track,
            ["lap"] = N(v, "Lap"),
            ["sessionTime"] = N(v, "SessionTime"),
            ["lastLap"] = N(v, "LapLastLapTime"),
            ["bestLap"] = N(v, "LapBestLapTime"),
            ["delta"] = N(v, "LapDeltaToBestLap"),
            ["waterTemp"] = N(v, "WaterTemp"),
            ["oilTemp"] = N(v, "OilTemp"),
            ["airTemp"] = N(v, "AirTemp"),
            ["trackTemp"] = N(v, "TrackTempCrew"),
            ["tyreFL"] = N(v, "LFtempCM"),
            ["tyreFR"] = N(v, "RFtempCM"),
            ["tyreRL"] = N(v, "LRtempCM"),
            ["tyreRR"] = N(v, "RRtempCM"),
            ["positionOverall"] = player?.GetValueOrDefault("positionOverall"),
            ["classPosition"] = player?.GetValueOrDefault("classPosition"),
            ["driverName"] = player?.GetValueOrDefault("driverName"),
            ["carNumber"] = player?.GetValueOrDefault("carNumber"),
            ["carIdx"] = playerIdx,
            ["sessionFlags"] = N(v, "SessionFlags"),
            ["onPitRoad"] = v.GetValueOrDefault("OnPitRoad"),
            ["tc"] = N(v, "dcTractionControl"),
            ["abs"] = N(v, "dcABS")
        };
        // JSON omit null -> dados não disponibilizados nunca são simulados.
        return p.Where(x => x.Value is not null).ToDictionary(x => x.Key, x => x.Value);
    }
}

internal sealed class FullFidelityRecorder : IDisposable
{
    private StreamWriter? writer;
    private FileStream? stream;
    private string lastKey = "";
    private int records;
    private readonly string root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AMS", "SkunkTelemetry", "Sessions");

    internal void Record(SimSnapshot sample)
    {
        // Rotação por sessão e a cada ~100 000 amostras (~28m a 60 Hz).
        var key = sample.Simulator + "|" + sample.SessionKey + "|" + sample.Circuit;
        if (writer is null || key != lastKey || records >= 100_000)
        {
            Dispose();
            lastKey = key;
            Directory.CreateDirectory(root);
            string file = $"{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid():N}.jsonl.gz";
            stream = new FileStream(Path.Combine(root, file), FileMode.CreateNew, FileAccess.Write, FileShare.Read, 65_536);
            writer = new StreamWriter(new GZipStream(stream, CompressionLevel.Fastest, leaveOpen: true), new UTF8Encoding(false), 65_536);
            records = 0;
            writer.WriteLine(JsonSerializer.Serialize(new { kind = "session-info", sample.Simulator, sample.Circuit, sample.Car, sample.SessionKey, sessionInfo = sample.SessionInfo }));
        }
        writer!.WriteLine(JsonSerializer.Serialize(new
        {
            time = sample.CapturedAt,
            sample.Simulator, sample.Circuit, sample.Car, sample.SessionKey,
            sample.Tick, variables = sample.Channels, drivers = sample.Drivers
        }));
        records++;
        if (records % 300 == 0) writer.Flush();
    }
    public void Dispose()
    {
        writer?.Dispose();
        writer = null;
        stream?.Dispose();
        stream = null;
    }
}

/// <summary>Executa dentro do próprio .exe: captura SDK, conserva canais, cria voltas e publica live.</summary>
internal sealed class TelemetryPipeline : IDisposable
{
    private readonly ISimulatorAdapter[] sources = [new IRacingAdapter(), new AssettoCorsaAdapter(), new F1UdpAdapter()];
    private readonly FullFidelityRecorder recorder = new();
    private readonly CloudPublisher cloud = new();
    private readonly CancellationTokenSource stop = new();
    private readonly Task reader;
    private DateTimeOffset lastLive = DateTimeOffset.MinValue, lastLapSample = DateTimeOffset.MinValue;
    private readonly List<Dictionary<string, object?>> lap = [];
    private int lastCompleted = -1;
    private string lastSession = "";
    private bool recordingAvailable = true;
    internal event Action<string>? Status;
    internal event Action<SimSnapshot, IReadOnlyDictionary<string, object?>>? SampleCaptured;

    internal TelemetryPipeline()
    {
        cloud.Status += s => Status?.Invoke(s);
        reader = Task.Run(RunAsync);
    }

    internal void SetLogin(string? token, string? userId) => cloud.SetLogin(token, userId);

    private async Task RunAsync()
    {
        while (!stop.IsCancellationRequested)
        {
            try
            {
                SimSnapshot? snapshot = null;
                foreach (var adapter in sources)
                    if (adapter.TryRead(out snapshot)) break;

                if (snapshot is not null)
                {
                    if (recordingAvailable)
                    {
                        try { recorder.Record(snapshot); }
                        catch (IOException e) { recordingAvailable = false; Status?.Invoke("Erro de gravação local: " + e.Message); }
                        catch (UnauthorizedAccessException e) { recordingAvailable = false; Status?.Invoke("Sem acesso à gravação: " + e.Message); }
                    }

                    if (snapshot.Simulator == "F1 24/25" && GetNumber(snapshot, "PacketId") != 6)
                        continue; // Other UDP packet types remain in full-fidelity local archive.
                    var sample = TelemetryFields.Map(snapshot);
                    SampleCaptured?.Invoke(snapshot, sample);
                    if (snapshot.CapturedAt - lastLive >= TimeSpan.FromSeconds(1))
                    {
                        lastLive = snapshot.CapturedAt;
                        cloud.QueueLive(snapshot, sample);
                        Status?.Invoke(snapshot.Simulator + " ligado | aquisição local em curso");
                    }

                    string sessionIdentity = string.Join("|",snapshot.Simulator,snapshot.SessionKey,snapshot.Circuit,snapshot.Car);
                    if (sessionIdentity != lastSession)
                    {
                        lap.Clear();
                        lastCompleted = -1;
                        lastSession = sessionIdentity;
                        Status?.Invoke("Nova sessão: " + snapshot.Simulator + " / " +
                            (string.IsNullOrWhiteSpace(snapshot.Circuit) ? "pista desconhecida" : snapshot.Circuit) +
                            " / " + (string.IsNullOrWhiteSpace(snapshot.Car) ? "carro por identificar" : snapshot.Car));
                    }

                    // IRSDK LapCompleted is ideal; Lap-1 is a fallback for SDK
                    // sessions where the completed field is absent.
                    double? completedRaw = GetNumber(snapshot, "LapCompleted");
                    if (completedRaw is null && snapshot.Simulator == "iRacing")
                        completedRaw = GetNumber(snapshot, "Lap") is double l ? l - 1 : null;
                    if (snapshot.Simulator == "Assetto Corsa")
                        completedRaw ??= GetNumber(snapshot, "Lap") is double l ? l - 1 : null;
                    int completed = (int)(completedRaw ?? -1);
                    if (lastCompleted >= 0 && completed > lastCompleted)
                    {
                        double duration = GetNumber(snapshot, "LapLastLapTime") ??
                            (GetNumber(snapshot, "LastLapTimeMs") / 1000.0) ?? 0;
                        if (duration >= 20 && duration <= 7200 && lap.Count >= 20)
                        {
                            var saved = Downsample(lap, 1200);
                            while (saved.Count > 25 && JsonSerializer.SerializeToUtf8Bytes(saved).Length > 1_900_000)
                                saved = Downsample(saved, Math.Max(25, saved.Count / 2));
                            cloud.QueueLap(snapshot, completed, (int)Math.Round(duration * 1000), saved);
                        }
                        else
                        {
                            Status?.Invoke($"Volta {completed} não elegível: duração={duration:F2}s, amostras={lap.Count} (mín. 20).");
                        }
                        lap.Clear();
                    }
                    if (completed >= 0) lastCompleted = completed;
                    if (snapshot.CapturedAt - lastLapSample >= TimeSpan.FromMilliseconds(50))
                    {
                        lastLapSample = snapshot.CapturedAt;
                        var lapSample = new Dictionary<string, object?>(sample);
                        if (snapshot.Simulator == "iRacing" && lap.Count == 0)
                            lapSample["_capture"] = new { metadata = IracingTrackIdentity.Metadata(snapshot) };
                        lap.Add(lapSample);
                        if (lap.Count > 15_000) lap.RemoveRange(0, 1000);
                    }
                }
            }
            catch (Exception ex)
            {
                Status?.Invoke("Erro de aquisição: " + ex.Message);
            }
            try { await Task.Delay(12, stop.Token); }
            catch (OperationCanceledException) { break; }
        }
    }

    private static double? GetNumber(SimSnapshot s, string key)
    {
        if (!s.Channels.TryGetValue(key, out object? raw) || raw is null) return null;
        try { return Convert.ToDouble(raw); } catch { return null; }
    }

    private static List<Dictionary<string, object?>> Downsample(IReadOnlyList<Dictionary<string, object?>> values, int limit)
    {
        if (values.Count <= limit) return values.ToList();
        return Enumerable.Range(0, limit)
            .Select(i => values[(int)Math.Round(i * (values.Count - 1d) / (limit - 1d))]).ToList();
    }

    public void Dispose()
    {
        stop.Cancel();
        try { reader.Wait(TimeSpan.FromSeconds(3)); } catch { }
        cloud.Dispose();
        recorder.Dispose();
        foreach (var source in sources) source.Dispose();
        stop.Dispose();
    }
}
