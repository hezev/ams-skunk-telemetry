using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace AMSSkunkTelemetry.Desktop;

/// <summary>Publicação autenticada na mesma BD do portal. Sem service_role e sem coletor intermediário.</summary>
internal sealed class CloudPublisher : IDisposable
{
    private const string Supabase = "https://ntjvgeopzxwnstnecuhl.supabase.co";
    // Chave pública, igual à usada por wwwroot/js/config.js; nunca colocar secret/service_role aqui.
    private const string Publishable = "sb_publishable_E_lJBovejpFFRnqjifgfZA_KNAeex5P";

    private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(8) };
    private readonly Channel<Pending> jobs = Channel.CreateBounded<Pending>(new BoundedChannelOptions(128)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
        SingleWriter = false
    });
    private readonly CancellationTokenSource stop = new();
    private readonly Task worker;
    private readonly object authLock = new();
    private Auth? auth;
    internal event Action<string>? Status;

    private sealed record Auth(string Token, Guid PilotId);
    private sealed record Pending(Auth Credentials, string Path, string Conflict, object Payload);

    internal CloudPublisher() => worker = Task.Run(WorkAsync);

    internal void SetLogin(string? accessToken, string? pilotId)
    {
        lock (authLock)
        {
            auth = !string.IsNullOrWhiteSpace(accessToken) && Guid.TryParse(pilotId, out var uid)
                && accessToken.Length <= 8192 ? new Auth(accessToken, uid) : null;
        }
        Status?.Invoke(auth is null ? "Sessão terminada: sincronização suspensa" : "Sessão ligada: sincronização disponível");
    }

    private Auth? Current()
    {
        lock (authLock) return auth;
    }

    internal void QueueLive(SimSnapshot s, Dictionary<string, object?> sample)
    {
        var credentials = Current();
        if (credentials is null) return;
        // O SDK publica a grelha na sessão do piloto: só UMA linha por utilizador.
        // Não criamos utilizadores falsos para os adversários.
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
        jobs.Writer.TryWrite(new Pending(credentials,
            "/rest/v1/ams_live_sessions?on_conflict=pilot_id", "pilot_id", payload));
    }

    internal void QueueLap(SimSnapshot s, int lapNumber, int durationMs, IReadOnlyList<Dictionary<string, object?>> telemetry)
    {
        var credentials = Current();
        if (credentials is null) return;
        if (string.IsNullOrWhiteSpace(s.Circuit) || string.IsNullOrWhiteSpace(s.Car)) return;
        var payload = new
        {
            pilot_id = credentials.PilotId,
            local_lap_id = "desktop-iracing-" + Guid.NewGuid().ToString("N"),
            simulator = s.Simulator,
            circuit = s.Circuit,
            car = s.Car,
            session_id = string.IsNullOrWhiteSpace(s.SessionKey) ? "iracing-local" : s.SessionKey,
            lap_number = lapNumber,
            lap_time_ms = durationMs,
            completed_at = s.CapturedAt,
            telemetry,
            verified = false
        };
        jobs.Writer.TryWrite(new Pending(credentials,
            "/rest/v1/ams_laps?on_conflict=pilot_id,local_lap_id", "pilot_id,local_lap_id", payload));
    }

    private async Task WorkAsync()
    {
        try
        {
            await foreach (Pending job in jobs.Reader.ReadAllAsync(stop.Token))
            {
                var current = Current();
                // Não enviar dados captados sob a sessão de outro utilizador.
                if (current is null || current.PilotId != job.Credentials.PilotId) continue;
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Post, Supabase + job.Path);
                    request.Headers.Add("apikey", Publishable);
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", current.Token);
                    request.Headers.TryAddWithoutValidation("Prefer", "resolution=merge-duplicates,return=minimal");
                    request.Content = new StringContent(JsonSerializer.Serialize(job.Payload), Encoding.UTF8, "application/json");
                    using var response = await http.SendAsync(request, stop.Token);
                    if (!response.IsSuccessStatusCode)
                    {
                        string body = await response.Content.ReadAsStringAsync(stop.Token);
                        Status?.Invoke($"Supabase {(int)response.StatusCode}: {body[..Math.Min(body.Length, 130)]}");
                    }
                }
                catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
                catch (HttpRequestException ex) { Status?.Invoke("Sem ligação ao Supabase: " + ex.Message); }
                catch (TaskCanceledException) { Status?.Invoke("Timeout na sincronização cloud"); }
            }
        }
        catch (OperationCanceledException) { }
    }

    public void Dispose()
    {
        jobs.Writer.TryComplete();
        stop.Cancel();
        try { worker.Wait(TimeSpan.FromSeconds(3)); } catch { }
        http.Dispose();
        stop.Dispose();
    }
}
