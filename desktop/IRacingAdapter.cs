using System.IO.MemoryMappedFiles;
using System.Text;
using System.Text.RegularExpressions;

namespace AMSSkunkTelemetry.Desktop;

/// <summary>Snapshot da fonte simulador. "Channels" conserva todas as variáveis disponibilizadas pelo SDK.</summary>
internal sealed record SimSnapshot(
    string Simulator, string Circuit, string Car, string SessionKey, int Tick,
    DateTimeOffset CapturedAt, string SessionInfo, IReadOnlyDictionary<string, object?> Channels,
    IReadOnlyList<Dictionary<string, object?>> Drivers);

internal interface ISimulatorAdapter : IDisposable
{
    string Name { get; }
    bool TryRead(out SimSnapshot? snapshot);
}

/// <summary>
/// Acesso direto ao SDK iRacing, sem bridge, processo coletor ou dependências nativas.
/// Formato: irsdk_header (112B), irsdk_varHeader (144B) e buffers apontados pelo cabeçalho.
/// </summary>
internal sealed class IRacingAdapter : ISimulatorAdapter
{
    private const string Mapping = @"Local\IRSDKMemMapFileName";
    private MemoryMappedFile? memory;
    private MemoryMappedViewAccessor? view;
    private readonly Dictionary<string, (int Type, int Offset, int Count)> fields = new(StringComparer.Ordinal);
    private int lastSessionUpdate = -1;
    private int lastTick = -1;
    private string circuit = "";
    private string car = "";
    private string sessionKey = "";
    private string sessionInfo = "";
    private readonly Dictionary<int, (string Name, string Number, string Car)> drivers = new();

    public string Name => "iRacing";
    public bool TryRead(out SimSnapshot? snapshot)
    {
        snapshot = null;
        try
        {
            if (view is null)
            {
                memory = MemoryMappedFile.OpenExisting(Mapping, MemoryMappedFileRights.Read);
                view = memory.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            }

            if (view.Capacity < 112) return false;
            if ((view.ReadInt32(4) & 1) == 0) { Reset(); return false; }
            int count = view.ReadInt32(24), variableOffset = view.ReadInt32(28);
            int buffers = view.ReadInt32(32), bufferLength = view.ReadInt32(36);
            if (count <= 0 || count > 4096 || buffers < 1 || buffers > 4 ||
                bufferLength <= 0 || bufferLength > 1024 * 1024 ||
                !Inside(variableOffset, (long)count * 144)) return false;

            int update = view.ReadInt32(12);
            if (fields.Count == 0 || update != lastSessionUpdate)
            {
                fields.Clear();
                for (int i = 0; i < count; i++)
                {
                    long offset = variableOffset + i * 144L;
                    int type = view.ReadInt32(offset);
                    int dataOffset = view.ReadInt32(offset + 4);
                    int elements = view.ReadInt32(offset + 8);
                    string name = ReadAscii(offset + 16, 32);
                    int elementSize = type switch { 0 or 1 => 1, 2 or 3 or 4 => 4, 5 => 8, _ => 0 };
                    if (name.Length > 0 && elementSize > 0 && elements > 0 &&
                        (long)dataOffset + elements * (long)elementSize <= bufferLength && dataOffset >= 0)
                        fields[name] = (type, dataOffset, elements);
                }
                int infoLen = view.ReadInt32(16), infoOffset = view.ReadInt32(20);
                if (infoLen >= 0 && infoLen <= 1024 * 1024 && Inside(infoOffset, infoLen))
                {
                    byte[] bytes = new byte[infoLen];
                    view.ReadArray(infoOffset, bytes, 0, infoLen);
                    sessionInfo = Encoding.UTF8.GetString(bytes).TrimEnd('\0');
                    ParseSessionInfo();
                }
                lastSessionUpdate = update;
                lastTick = -1;
            }

            // Escolher o buffer com tick mais recente; nunca publicar a mesma amostra duas vezes.
            int tick = int.MinValue, dataOffsetSelected = 0, bufferIndex = -1;
            for (int i = 0; i < buffers; i++)
            {
                int candidate = view.ReadInt32(48 + i * 16L);
                int start = view.ReadInt32(52 + i * 16L);
                if (candidate > tick && Inside(start, bufferLength))
                {
                    tick = candidate;
                    dataOffsetSelected = start;
                    bufferIndex = i;
                }
            }
            if (bufferIndex < 0 || tick <= lastTick) return false;

            byte[] data = new byte[bufferLength];
            view.ReadArray(dataOffsetSelected, data, 0, bufferLength);
            // Rejeitar buffer alterado durante a cópia.
            if (view.ReadInt32(48 + bufferIndex * 16L) != tick) return false;

            var values = new Dictionary<string, object?>(fields.Count, StringComparer.Ordinal);
            foreach (var (name, descriptor) in fields)
            {
                var (type, offset, elements) = descriptor;
                object? ReadAt(int n)
                {
                    int x = offset + n * (type switch { 0 or 1 => 1, 5 => 8, _ => 4 });
                    return type switch
                    {
                        0 => (int)data[x],
                        1 => data[x] != 0,
                        2 or 3 => BitConverter.ToInt32(data, x),
                        4 => float.IsFinite(BitConverter.ToSingle(data, x)) ? (object)BitConverter.ToSingle(data, x) : null,
                        5 => double.IsFinite(BitConverter.ToDouble(data, x)) ? (object)BitConverter.ToDouble(data, x) : null,
                        _ => null
                    };
                }
                values[name] = elements == 1 ? ReadAt(0) :
                    Enumerable.Range(0, elements).Select(ReadAt).ToArray();
            }
            lastTick = tick;
            var pit = BuildDrivers(values);
            snapshot = new SimSnapshot(Name, circuit, car,
                sessionKey, tick, DateTimeOffset.UtcNow, sessionInfo, values, pit);
            return true;
        }
        catch (FileNotFoundException) { Reset(); return false; }
        catch (IOException) { Reset(); return false; }
        catch (UnauthorizedAccessException) { Reset(); return false; }
        catch (ArgumentException) { Reset(); return false; }
    }

    private List<Dictionary<string, object?>> BuildDrivers(Dictionary<string, object?> values)
    {
        double[]? positions = ArrayOf(values, "CarIdxLapDistPct");
        if (positions is null) return [];
        var racePos = ArrayOf(values, "CarIdxPosition");
        var classPos = ArrayOf(values, "CarIdxClassPosition");
        var laps = ArrayOf(values, "CarIdxLap");
        var lastLaps = ArrayOf(values, "CarIdxLastLapTime");
        var bestLaps = ArrayOf(values, "CarIdxBestLapTime");
        var results = new List<Dictionary<string, object?>>(positions.Length);
        for (int i = 0; i < positions.Length; i++)
        {
            if (positions[i] < 0 || positions[i] > 1 || (!drivers.ContainsKey(i) && (racePos is null || i >= racePos.Length || racePos[i] <= 0)))
                continue;
            var entry = drivers.GetValueOrDefault(i);
            var driver = new Dictionary<string, object?>
            {
                ["carIdx"] = i,
                ["driverName"] = string.IsNullOrWhiteSpace(entry.Name) ? $"Car {i}" : entry.Name,
                ["carNumber"] = entry.Number,
                ["carName"] = entry.Car,
                ["trackPositionPct"] = positions[i] * 100,
                ["positionOverall"] = At(racePos, i),
                ["classPosition"] = At(classPos, i),
                ["lap"] = At(laps, i),
                ["lastLap"] = At(lastLaps, i),
                ["bestLap"] = At(bestLaps, i)
            };
            results.Add(driver);
        }
        return results;
    }

    private static double? At(double[]? a, int i) => a is not null && i < a.Length ? a[i] : null;
    private static double[]? ArrayOf(Dictionary<string, object?> map, string field)
    {
        if (!map.TryGetValue(field, out var raw) || raw is not object?[] a) return null;
        return a.Select(v => v is IConvertible x ? Convert.ToDouble(x) : -1).ToArray();
    }
    private bool Inside(long start, long length) =>
        view != null && start >= 0 && length >= 0 && start <= view.Capacity && length <= view.Capacity - start;

    private string ReadAscii(long offset, int length)
    {
        var b = new byte[length];
        view!.ReadArray(offset, b, 0, length);
        return Encoding.ASCII.GetString(b).Split('\0')[0];
    }

    private void ParseSessionInfo()
    {
        // Session YAML é conservada à parte; estes nomes são só etiquetas de interface.
        string Key(string key)
        {
            var match = Regex.Match(sessionInfo, @"(?m)^\s*" + Regex.Escape(key) + @":\s*(.*?)\s*$");
            return match.Success ? match.Groups[1].Value.Trim(' ', '"', '\'') : "";
        }
        circuit = Key("TrackDisplayName");
        if (string.IsNullOrEmpty(circuit)) circuit = Key("TrackName");
        car = Key("DriverCarName");
        if (string.IsNullOrEmpty(car)) car = Key("DriverCarScreenName");
        sessionKey = Key("SessionUniqueID");
        if (string.IsNullOrEmpty(sessionKey)) sessionKey = Key("SubSessionID");
        drivers.Clear();
        int? idx = null;
        string name = "", number = "", carName = "";
        void Save()
        {
            if (idx is int n) drivers[n] = (name, number, carName);
        }
        foreach (string line in sessionInfo.Split('\n'))
        {
            var m = Regex.Match(line, @"^\s*-\s*CarIdx:\s*(\d+)");
            if (m.Success)
            {
                Save();
                idx = int.Parse(m.Groups[1].Value);
                name = number = carName = "";
                continue;
            }
            if (idx is null) continue;
            var val = Regex.Match(line, @"^\s+(UserName|CarNumber|CarScreenName):\s*(.*)$");
            if (!val.Success) continue;
            string value = val.Groups[2].Value.Trim(' ', '"', '\'', '\r');
            switch (val.Groups[1].Value)
            {
                case "UserName": name = value; break;
                case "CarNumber": number = value; break;
                case "CarScreenName": carName = value; break;
            }
        }
        Save();
    }
    private void Reset()
    {
        view?.Dispose();
        memory?.Dispose();
        view = null;
        memory = null;
        fields.Clear();
        lastSessionUpdate = lastTick = -1;
    }
    public void Dispose() => Reset();
}
