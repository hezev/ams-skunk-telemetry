using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace AMSSkunkTelemetry.Desktop;

/// <summary>Cloud sync with an on-disk outbox for completed laps and best-effort live snapshots.</summary>
internal sealed class CloudPublisher : IDisposable
{
    private const string Supabase = "https://ntjvgeopzxwnstnecuhl.supabase.co";
    private const string Publishable = "sb_publishable_E_lJBovejpFFRnqjifgfZA_KNAeex5P";

    private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(12) };
    private readonly Channel<Pending> liveJobs = Channel.CreateBounded<Pending>(new BoundedChannelOptions(16)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true, SingleWriter = false
    });
    private readonly CancellationTokenSource stop = new();
    private readonly Task worker;
    private readonly object authLock = new();
    private Auth? auth;
    private DateTimeOffset nextLapFlush = DateTimeOffset.MinValue;
    private DateTimeOffset lastConfirmedLive = DateTimeOffset.MinValue;
    private readonly string root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AMS", "SkunkTelemetry");
    private string Outbox => Path.Combine(root, "PendingLaps");
    private string LogPath => Path.Combine(root, "Logs", "cloud.log");
    internal event Action<string>? Status;

    private sealed record Auth(string Token, Guid PilotId);
    private sealed record Pending(Auth Credentials, object Payload);

    internal CloudPublisher() => worker = Task.Run(WorkAsync);

    private void Note(string message)
    {
        Status?.Invoke(message);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
            File.AppendAllText(LogPath, $"{DateTimeOffset.UtcNow:O} {message}{Environment.NewLine}", Encoding.UTF8);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    internal void SetLogin(string? accessToken, string? pilotId)
    {
        lock (authLock)
            auth = !string.IsNullOrWhiteSpace(accessToken) &&
                   Guid.TryParse(pilotId, out Guid id) && accessToken.Length <= 8192
                ? new Auth(accessToken, id) : null;
        Note(Current() is null ? "Sem login AMS: Live e voltas não podem ser enviados ao Supabase." :
            "Conta AMS ligada: sincronização Live e arquivo de voltas ativos.");
        nextLapFlush = DateTimeOffset.MinValue;
    }

    private Auth? Current()
    {
        lock (authLock) return auth;
    }

    internal void QueueLive(SimSnapshot s, Dictionary<string, object?> sample)
    {
        var credentials = Current();
        if (credentials is null) return;
        var payload = new
        {
            pilot_id = credentials.PilotId,
            simulator = s.Simulator,
            circuit = s.Circuit,
            car = s.Car,
            sample,
            drivers = s.Drivers,
            updated_at = s.CapturedAt
        };
        liveJobs.Writer.TryWrite(new Pending(credentials, payload));
    }

    internal void QueueLap(SimSnapshot s, int lapNumber, int durationMs,
        IReadOnlyList<Dictionary<string, object?>> telemetry)
    {
        var credentials = Current();
        if (credentials is null)
        {
            Note($"Volta {lapNumber}: sem login AMS; arquivo bruto permanece no PC.");
            return;
        }

        // A valid session must never disappear because a display name was absent.
        // Unknown labels remain explicit; we do not assign an opponent's vehicle.
        string circuit = s.Circuit.Trim();
        if (string.IsNullOrWhiteSpace(circuit))
        {
            var metadata = IracingTrackIdentity.Metadata(s);
            if (!metadata.TryGetValue("TrackName", out circuit) || string.IsNullOrWhiteSpace(circuit))
                circuit = "Pista não identificada";
        }
        string car = string.IsNullOrWhiteSpace(s.Car) ? "Carro não identificado" : s.Car.Trim();
        if (string.IsNullOrWhiteSpace(s.Car))
            Note("iRacing: identificação do carro em falta; volta será preservada para sincronização.");
        // DB constrains circuit/car length to 1–120.
        circuit = circuit.Length > 120 ? circuit[..120] : circuit;
        car = car.Length > 120 ? car[..120] : car;
        var payload = new
        {
            pilot_id = credentials.PilotId,
            local_lap_id = "desktop-v6-" + Guid.NewGuid().ToString("N"),
            simulator = s.Simulator,
            circuit,
            car,
            session_id = string.IsNullOrWhiteSpace(s.SessionKey) ? "local-" + s.Simulator : s.SessionKey,
            lap_number = lapNumber,
            lap_time_ms = durationMs,
            completed_at = s.CapturedAt,
            telemetry,
            verified = false
        };
        try
        {
            Directory.CreateDirectory(Outbox);
            string fileName = $"{credentials.PilotId:N}-{DateTimeOffset.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.json";
            var destination = Path.Combine(Outbox, fileName);
            var tmp = destination + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(new { pilot_id = credentials.PilotId, payload }), Encoding.UTF8);
            File.Move(tmp, destination);
            Note($"Volta {lapNumber} ({durationMs / 1000d:F3}s) guardada na fila local para Supabase.");
            nextLapFlush = DateTimeOffset.MinValue;
        }
        catch (IOException e) { Note("Erro ao guardar volta para sincronização: " + e.Message); }
        catch (UnauthorizedAccessException e) { Note("Sem acesso à fila de voltas: " + e.Message); }
    }

    private async Task<(bool Success, int Status, string Error)> SendAsync(Auth credentials,
        string endpoint, string payload, bool isLive)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Supabase + endpoint);
        request.Headers.TryAddWithoutValidation("apikey", Publishable);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", credentials.Token);
        // Upsert is authorized by Live INSERT+UPDATE+SELECT policies.
        // ams_laps has INSERT+SELECT only: ordinary insert, not merge-upsert.
        request.Headers.TryAddWithoutValidation("Prefer", isLive
            ? "resolution=merge-duplicates,return=minimal" : "return=minimal");
        request.Content = new StringContent(payload, Encoding.UTF8, "application/json");
        using var response = await http.SendAsync(request, stop.Token);
        if (response.IsSuccessStatusCode) return (true, (int)response.StatusCode, "");
        string body = await response.Content.ReadAsStringAsync(stop.Token);
        // A retry after a successful insert can produce a duplicate unique key.
        // Only for persisted lap jobs is 23505 on local_lap_id considered delivered.
        bool duplicate = !isLive && (int)response.StatusCode == 409 &&
            body.Contains("23505", StringComparison.Ordinal) &&
            body.Contains("ams_laps_pilot_id_local_lap_id_key", StringComparison.Ordinal);
        return (duplicate, (int)response.StatusCode, body[..Math.Min(body.Length, 220)]);
    }

    private async Task FlushPendingLapsAsync(Auth credentials)
    {
        if (!Directory.Exists(Outbox)) return;
        // Bounded batch keeps Live responsive on slower networks.
        foreach (var file in Directory.EnumerateFiles(Outbox, "*.json")
                     .Where(x => Path.GetFileName(x).StartsWith(credentials.PilotId.ToString("N") + "-", StringComparison.OrdinalIgnoreCase))
                     .OrderBy(x => x).Take(8))
        {
            if (stop.IsCancellationRequested || Current()?.PilotId != credentials.PilotId) break;
            try
            {
                using var document = JsonDocument.Parse(await File.ReadAllTextAsync(file, stop.Token));
                var root = document.RootElement;
                if (!root.TryGetProperty("pilot_id", out var pilotProperty) ||
                    !Guid.TryParse(pilotProperty.GetString(), out Guid owner))
                {
                    Note("Fila local: ficheiro inválido, mantido para diagnóstico.");
                    continue;
                }
                // Never send another driver's queued lap after account change.
                if (owner != credentials.PilotId) continue;
                string json = root.GetProperty("payload").GetRawText();
                var (success, code, error) = await SendAsync(credentials,"/rest/v1/ams_laps",json,false);
                if (!success)
                {
                    Note($"Supabase não aceitou volta pendente (HTTP {code}): {error}");
                    break;
                }
                File.Delete(file);
                Note("Volta enviada e confirmada no Supabase.");
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
            catch (HttpRequestException e) { Note("Rede indisponível; voltas mantidas no PC: " + e.Message); break; }
            catch (TaskCanceledException) { Note("Timeout Supabase; fila de voltas preservada."); break; }
            catch (IOException e) { Note("Fila de voltas indisponível: " + e.Message); break; }
            catch (JsonException e) { Note("Fila local ilegível, ficheiro preservado: " + e.Message); break; }
        }
    }

    private async Task WorkAsync()
    {
        try
        {
            while (!stop.IsCancellationRequested)
            {
                if (liveJobs.Reader.TryRead(out var job))
                {
                    var current = Current();
                    if (current is not null && current.PilotId == job.Credentials.PilotId)
                    {
                        try
                        {
                            var (success, code, error) = await SendAsync(current,
                                "/rest/v1/ams_live_sessions?on_conflict=pilot_id",
                                JsonSerializer.Serialize(job.Payload), true);
                            if (!success) Note($"Supabase Live HTTP {code}: {error}");
                            else if (DateTimeOffset.UtcNow - lastConfirmedLive > TimeSpan.FromMinutes(1))
                            {
                                lastConfirmedLive = DateTimeOffset.UtcNow;
                                Note("Supabase Live: receção confirmada.");
                            }
                        }
                        catch (HttpRequestException e) { Note("Sem rede Supabase Live: " + e.Message); }
                        catch (TaskCanceledException) { Note("Timeout Supabase Live."); }
                    }
                }
                var authNow = Current();
                if (authNow is not null && DateTimeOffset.UtcNow >= nextLapFlush)
                {
                    nextLapFlush = DateTimeOffset.UtcNow + TimeSpan.FromSeconds(12);
                    await FlushPendingLapsAsync(authNow);
                }
                await Task.Delay(400, stop.Token);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception e) { Note("Erro inesperado no sincronizador: " + e.Message); }
    }

    public void Dispose()
    {
        liveJobs.Writer.TryComplete();
        stop.Cancel();
        try { worker.Wait(TimeSpan.FromSeconds(3)); } catch { }
        http.Dispose();
        stop.Dispose();
    }
}
