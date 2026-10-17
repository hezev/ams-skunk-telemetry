using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace AMSSkunkTelemetry.Desktop;

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
    private readonly ISimulatorAdapter[] sources = [new IRacingAdapter()];
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

                    var sample = TelemetryFields.Map(snapshot);
                    if (snapshot.CapturedAt - lastLive >= TimeSpan.FromSeconds(1))
                    {
                        lastLive = snapshot.CapturedAt;
                        cloud.QueueLive(snapshot, sample);
                        Status?.Invoke("iRacing ligado | aquisição local em curso");
                    }

                    if (snapshot.SessionKey != lastSession)
                    {
                        lap.Clear();
                        lastCompleted = -1;
                        lastSession = snapshot.SessionKey;
                    }

                    int completed = (int)(GetNumber(snapshot, "LapCompleted") ?? -1);
                    if (lastCompleted >= 0 && completed > lastCompleted)
                    {
                        double duration = GetNumber(snapshot, "LapLastLapTime") ?? 0;
                        if (duration >= 20 && duration <= 7200 && lap.Count >= 20)
                        {
                            // Limite da tabela AMS: 2 MiB na volta. Se necessário, reduzir amostras.
                            var saved = Downsample(lap, 1200);
                            while (saved.Count > 25 && JsonSerializer.SerializeToUtf8Bytes(saved).Length > 1_900_000)
                                saved = Downsample(saved, Math.Max(25, saved.Count / 2));
                            cloud.QueueLap(snapshot, completed, (int)Math.Round(duration * 1000), saved);
                        }
                        lap.Clear();
                    }
                    if (completed >= 0) lastCompleted = completed;
                    if (snapshot.CapturedAt - lastLapSample >= TimeSpan.FromMilliseconds(50))
                    {
                        lastLapSample = snapshot.CapturedAt;
                        lap.Add(sample);
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
