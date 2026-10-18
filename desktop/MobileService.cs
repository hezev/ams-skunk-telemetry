using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using QRCoder;

namespace AMSSkunkTelemetry.Desktop;

/// <summary>Mobile v6 lives inside the main .exe. Compatible with the existing Android SSE /stream endpoint.</summary>
internal sealed class MobileService : IAsyncDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly object sync = new();
    private readonly string settingsPath = Path.Combine(Environment.GetFolderPath(
        Environment.SpecialFolder.LocalApplicationData), "AMS", "SkunkTelemetry", "mobile-settings.json");
    private WebApplication? server;
    private int port, clients;
    private string pin = NewPin();
    private bool enabled;
    private object packet = new { mode = "iracing", status = "waiting", message = "À espera de simulador", data = new { }, meta = new { }, updated = "" };
    private DateTimeOffset lastData = DateTimeOffset.MinValue;
    internal event Action? Changed;

    private sealed class MobileOptions { public bool Enabled { get; set; } public string? Pin { get; set; } }

    public MobileService()
    {
        try
        {
            var settings = JsonSerializer.Deserialize<MobileOptions>(File.ReadAllText(settingsPath));
            if (settings?.Pin is { Length: 6 } p && p.All(char.IsDigit)) pin = p;
            enabled = settings?.Enabled ?? false;
        }
        catch (IOException) { }
        catch (JsonException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static string NewPin() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

    private void Save(bool active)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(settingsPath)!);
        File.WriteAllText(settingsPath, JsonSerializer.Serialize(new MobileOptions { Enabled = active, Pin = pin }));
    }

    internal void Publish(SimSnapshot source, IReadOnlyDictionary<string, object?> values)
    {
        var snap = new
        {
            mode = "iracing",
            status = "live",
            message = "Telemetria real recebida",
            data = values,
            meta = new Dictionary<string, string>
            {
                ["sim"] = source.Simulator,
                ["track"] = source.Circuit,
                ["car"] = source.Car
            },
            updated = source.CapturedAt
        };
        lock (sync) { packet = snap; lastData = source.CapturedAt; }
    }

    private object CurrentPacket()
    {
        lock (sync)
        {
            if (DateTimeOffset.UtcNow - lastData < TimeSpan.FromSeconds(4)) return packet;
            return new { mode = "iracing", status = "waiting", message = "Sem dados recentes",
                data = new { }, meta = new { }, updated = DateTimeOffset.UtcNow };
        }
    }

    internal object Status()
    {
        int p;
        string secret;
        bool isOn;
        lock (sync) { p = port; secret = pin; isOn = server is not null; }
        var ips = LocalIPs().ToArray();
        string pairing = isOn && ips.Length > 0 ?
            $"amsports://pair?host={ips[0]}&port={p}&pin={secret}" : "";
        string? qr = null;
        if (pairing.Length > 0)
        {
            try
            {
                using var gen = new QRCodeGenerator();
                using var data = gen.CreateQrCode(pairing, QRCodeGenerator.ECCLevel.Q);
                qr = "data:image/png;base64," + Convert.ToBase64String(new PngByteQRCode(data).GetGraphic(8));
            }
            catch { /* The manual host/port/PIN pairing stays functional without QR. */ }
        }
        return new { enabled = isOn, port = p, pin = secret, ips,
            clients = Volatile.Read(ref clients), pairing, qr,
            simulator = "iRacing", mode = "SSE", version = "6.0.1" };
    }

    internal async Task SetEnabledAsync(bool state)
    {
        await gate.WaitAsync();
        try
        {
            if (state && server is null)
            {
                Exception? last = null;
                for (int candidate = 8181; candidate <= 8190; candidate++)
                {
                    var builder = WebApplication.CreateSlimBuilder();
                    builder.WebHost.UseKestrel().UseUrls($"http://0.0.0.0:{candidate}");
                    var app = builder.Build();
                    app.MapGet("/health", async ctx =>
                    {
                        if (!Authorize(ctx)) return;
                        await ctx.Response.WriteAsJsonAsync(new { ok = true, service = "AMSports Skunk Telemetry v6", status = "active" });
                    });
                    app.MapGet("/stream", async ctx =>
                    {
                        if (!Authorize(ctx)) return;
                        ctx.Response.ContentType = "text/event-stream; charset=utf-8";
                        ctx.Response.Headers.CacheControl = "no-cache, no-transform";
                        ctx.Response.Headers["X-Accel-Buffering"] = "no";
                        Interlocked.Increment(ref clients);
                        Changed?.Invoke();
                        try
                        {
                            await ctx.Response.WriteAsync("retry: 1000\n\n");
                            await ctx.Response.Body.FlushAsync();
                            string? lastSample = null;
                            while (!ctx.RequestAborted.IsCancellationRequested)
                            {
                                if (!PinMatches(ctx.Request.Query["pin"].ToString())) break;
                                string current = JsonSerializer.Serialize(CurrentPacket());
                                if (current != lastSample)
                                {
                                    lastSample = current;
                                    await ctx.Response.WriteAsync("data: " + current + "\n\n", ctx.RequestAborted);
                                    await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
                                }
                                await Task.Delay(100, ctx.RequestAborted);
                            }
                        }
                        catch (OperationCanceledException) { }
                        catch (IOException) { }
                        finally
                        {
                            Interlocked.Decrement(ref clients);
                            Changed?.Invoke();
                        }
                    });
                    try
                    {
                        await app.StartAsync();
                        lock (sync) { server = app; port = candidate; }
                        last = null;
                        break;
                    }
                    catch (Exception ex) when (ex is IOException or InvalidOperationException)
                    {
                        last = ex;
                        await app.DisposeAsync();
                    }
                }
                if (server is null) throw new IOException("Portas 8181–8190 indisponíveis", last);
            }
            else if (!state && server is not null)
            {
                WebApplication app;
                lock (sync) { app = server; server = null; port = 0; }
                await app.StopAsync();
                await app.DisposeAsync();
            }
            enabled = state;
            Save(state);
        }
        finally { gate.Release(); Changed?.Invoke(); }
    }

    internal async Task InitializeAsync()
    {
        if (enabled) await SetEnabledAsync(true);
    }

    internal void RotatePin()
    {
        lock (sync) pin = NewPin();
        Save(server is not null);
        Changed?.Invoke();
    }

    private bool Authorize(HttpContext ctx)
    {
        // LAN-only access. Mobile needs a PIN, not a Supabase JWT.
        ctx.Response.Headers["Access-Control-Allow-Origin"] = "*";
        ctx.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
        ctx.Response.Headers.CacheControl = "no-store";
        var ip = ctx.Connection.RemoteIpAddress;
        if (ip?.IsIPv4MappedToIPv6 == true) ip = ip.MapToIPv4();
        if (ip is null || !(IPAddress.IsLoopback(ip) || IsPrivate(ip)))
        {
            ctx.Response.StatusCode = 403;
            return false;
        }
        if (!PinMatches(ctx.Request.Query["pin"].ToString()))
        {
            ctx.Response.StatusCode = 401;
            return false;
        }
        return true;
    }

    private bool PinMatches(string candidate)
    {
        string p;
        lock (sync) p = pin;
        if (candidate.Length != 6) return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(candidate), Encoding.ASCII.GetBytes(p));
    }

    private static bool IsPrivate(IPAddress ip)
    {
        var v = ip.GetAddressBytes();
        return v.Length == 4 && (v[0] == 10 ||
            (v[0] == 172 && v[1] >= 16 && v[1] <= 31) ||
            (v[0] == 192 && v[1] == 168));
    }

    private static IEnumerable<string> LocalIPs()
    {
        return NetworkInterface.GetAllNetworkInterfaces()
            .Where(n => n.OperationalStatus == OperationalStatus.Up &&
                        n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
            .SelectMany(n => n.GetIPProperties().UnicastAddresses)
            .Select(a => a.Address)
            .Where(a => a.AddressFamily == AddressFamily.InterNetwork && IsPrivate(a))
            .Select(a => a.ToString()).Distinct();
    }

    public async ValueTask DisposeAsync()
    {
        if (server is not null) await SetEnabledAsync(false);
        gate.Dispose();
    }
}
