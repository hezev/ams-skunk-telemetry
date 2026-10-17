using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Drawing;
using System.Text.Json;

namespace AMSSkunkTelemetry.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private const string Home = "https://ams-telemetry.local/index.html";
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };
    private readonly Label statusLabel = new()
    {
        Text = "À procura do simulador | inicia sessão para sincronizar com o site",
        ForeColor = Color.White,
        BackColor = Color.FromArgb(20, 26, 34),
        Dock = DockStyle.Bottom,
        TextAlign = ContentAlignment.MiddleLeft,
        Height = 25,
        Padding = new Padding(10, 0, 0, 0)
    };
    private string currentLanguage = "pt";
    private string rawStatus = "À procura do simulador | inicia sessão para sincronizar com o site";
    private readonly TelemetryPipeline telemetry = new();
    private readonly MobileService mobile = new();
    private readonly string dataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AMS", "SkunkTelemetry", "WebView2");

    public MainForm()
    {
        Text = "AMSports Skunk Telemetry v6.0 | Racing Engineering";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1050, 650);
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(7, 9, 12);
        Controls.Add(browser);
        Controls.Add(statusLabel);
        telemetry.Status += UpdateStatus;
        telemetry.SampleCaptured += (snapshot, sample) => mobile.Publish(snapshot, sample);
        mobile.Changed += PostMobileStatus;
        Shown += async (_, _) => await InitializeAsync();
        FormClosing += (_, _) => { telemetry.Dispose(); mobile.DisposeAsync().AsTask().GetAwaiter().GetResult(); };
    }

    private void UpdateStatus(string message)
    {
        if (IsDisposed || !IsHandleCreated) return;
        try
        {
            if (InvokeRequired) BeginInvoke(() => { if (!IsDisposed) { rawStatus = message; statusLabel.Text = TranslateStatus(message); PostToUI(new { kind = "ams.desktop.sim.status", message = TranslateStatus(message) }); } });
            else { statusLabel.Text = message; PostToUI(new { kind = "ams.desktop.sim.status", message }); }
        }
        catch (InvalidOperationException) { }
    }

    private string TranslateStatus(string message)
    {
        if (currentLanguage != "en") return message;
        string output = message;
        var labels = new (string Portuguese, string English)[]
        {
            ("À procura do simulador", "Looking for simulator"),
            ("inicia sessão para sincronizar com o site", "sign in to sync with the website"),
            ("À espera de simulador", "Waiting for simulator"),
            ("ligado | aquisição local em curso", "connected | local telemetry capture running"),
            ("Erro de aquisição:", "Capture error:"),
            ("Erro de gravação local:", "Local recording error:"),
            ("Sem acesso à gravação:", "Recording access denied:"),
            ("Mobile indisponível:", "Mobile unavailable:"),
            ("Sessão terminada: sincronização suspensa", "Signed out: synchronization paused"),
            ("Sessão ligada: sincronização disponível", "Signed in: synchronization ready"),
            ("Sem ligação ao Supabase:", "Supabase connection unavailable:"),
            ("Timeout na sincronização cloud", "Cloud synchronization timeout")
        };
        foreach (var (portuguese, english) in labels)
            output = output.Replace(portuguese, english, StringComparison.Ordinal);
        return output;
    }

    private static readonly string Bridge = """
        (() => {
          async function sendSession() {
            if (!window.AMSAuth || !window.chrome?.webview) return;
            let token = null;
            let userId = window.AMSAuth.user?.id || null;
            if (userId) {
              try { token = await window.AMSAuth.token(); } catch {}
            }
            window.chrome.webview.postMessage({
              kind: "ams.desktop.session", userId, accessToken: token
            });
          }
          document.addEventListener("ams-auth-changed", sendSession);
          document.addEventListener("DOMContentLoaded", () => {
            setTimeout(sendSession, 500);
            setTimeout(sendSession, 3000);
          });
          setInterval(sendSession, 60_000);
          function sendLanguage() {
            window.chrome?.webview?.postMessage({
              kind: 'ams.desktop.language',
              language: window.AMSi18n?.getLanguage?.() || 'pt'
            });
          }
          document.addEventListener('ams:languagechange', sendLanguage);
          document.addEventListener('DOMContentLoaded', () => setTimeout(sendLanguage, 300));

          document.addEventListener("DOMContentLoaded", () => {
            const css = document.createElement('link');
            css.rel = 'stylesheet'; css.href = 'desktop/ams-v6-desktop.css';
            document.head.append(css);
            const js = document.createElement('script');
            js.src = 'desktop/ams-v6-desktop.js';
            document.body.append(js);
          });
        })();
        """;

    private async Task InitializeAsync()
    {
        var assets = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (!File.Exists(Path.Combine(assets, "index.html")))
        {
            ShowError("A interface local não foi encontrada. Reinstala a aplicação.");
            return;
        }

        try
        {
            try { await mobile.InitializeAsync(); }
            catch (Exception ex) { UpdateStatus("Mobile indisponível: " + ex.Message); }
            Directory.CreateDirectory(dataFolder);
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: dataFolder);
            await browser.EnsureCoreWebView2Async(environment);
            var core = browser.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping(
                "ams-telemetry.local", assets, CoreWebView2HostResourceAccessKind.Allow);
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreHostObjectsAllowed = false;

            core.NavigationStarting += (_, e) =>
            {
                if (!IsLocalUrl(e.Uri))
                {
                    e.Cancel = true;
                    if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var url)
                        && (url.Scheme == Uri.UriSchemeHttps || url.Scheme == Uri.UriSchemeHttp))
                        OpenExternal(e.Uri);
                }
            };
            core.NewWindowRequested += (_, e) =>
            {
                e.Handled = true;
                if (!IsLocalUrl(e.Uri)) OpenExternal(e.Uri);
            };
            core.WebMessageReceived += async (_, e) =>
            {
                if (!IsLocalUrl(e.Source)) return;
                try
                {
                    using var data = JsonDocument.Parse(e.WebMessageAsJson);
                    var root = data.RootElement;
                    if (root.ValueKind != JsonValueKind.Object ||
                        !root.TryGetProperty("kind", out var kind)) return;
                    var action = kind.GetString();
                    if (action == "ams.desktop.language")
                    {
                        if (root.TryGetProperty("language", out var selected))
                        {
                            var language = selected.GetString();
                            if (language is "pt" or "en") currentLanguage = language;
                            statusLabel.Text = TranslateStatus(rawStatus);
                        }
                        return;
                    }
                    if (action == "ams.desktop.obs.test")
                    {
                        bool reachable = false;
                        string detail;
                        try
                        {
                            using var obs = new System.Net.WebSockets.ClientWebSocket();
                            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                            await obs.ConnectAsync(new Uri("ws://127.0.0.1:4455"), timeout.Token);
                            reachable = obs.State == System.Net.WebSockets.WebSocketState.Open;
                            detail = reachable ? "OBS WebSocket acessível; autenticação e gravação ainda não configuradas." : "Sem ligação ao OBS.";
                        }
                        catch (Exception ex) { detail = ex.Message; }
                        PostToUI(new { kind = "ams.desktop.obs.status", reachable, detail });
                        return;
                    }
                    if (action == "ams.desktop.mobile.status") { PostMobileStatus(); return; }
                    if (action == "ams.desktop.mobile.rotate") { mobile.RotatePin(); return; }
                    if (action == "ams.desktop.mobile.toggle")
                    {
                        bool enable = root.TryGetProperty("enabled", out var flag) && flag.ValueKind == JsonValueKind.True;
                        try { await mobile.SetEnabledAsync(enable); }
                        catch (Exception ex) { PostToUI(new { kind = "ams.desktop.mobile.error", message = ex.Message }); }
                        return;
                    }
                    if (action != "ams.desktop.session") return;
                    string? user = root.TryGetProperty("userId", out var id) &&
                        id.ValueKind == JsonValueKind.String ? id.GetString() : null;
                    string? token = root.TryGetProperty("accessToken", out var access) &&
                        access.ValueKind == JsonValueKind.String ? access.GetString() : null;
                    telemetry.SetLogin(token, user);
                }
                catch (JsonException) { }
                catch (InvalidOperationException) { }
            };

            await core.AddScriptToExecuteOnDocumentCreatedAsync(Bridge);
            browser.Source = new Uri(Home);
            PostMobileStatus();
        }
        catch (Exception ex)
        {
            ShowError("Não foi possível iniciar o WebView2: " + ex.Message);
        }
    }

    private void PostToUI(object value)
    {
        if (browser.CoreWebView2 is null || IsDisposed) return;
        if (InvokeRequired)
        {
            BeginInvoke(() => PostToUI(value));
            return;
        }
        try { browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(value)); }
        catch (InvalidOperationException) { }
    }
    private void PostMobileStatus() => PostToUI(new { kind = "ams.desktop.mobile.status", state = mobile.Status() });

    private static bool IsLocalUrl(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var parsed) &&
        parsed.Scheme == Uri.UriSchemeHttps &&
        string.Equals(parsed.Host, "ams-telemetry.local", StringComparison.OrdinalIgnoreCase);

    private static void OpenExternal(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) ||
            (parsed.Scheme != Uri.UriSchemeHttps && parsed.Scheme != Uri.UriSchemeHttp)) return;
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(parsed.AbsoluteUri)
                { UseShellExecute = true });
        }
        catch { /* Link externo sem browser disponível; a aplicação mantém-se segura. */ }
    }

    private void ShowError(string message) =>
        MessageBox.Show(this, message, "AMS Skunk Telemetry", MessageBoxButtons.OK, MessageBoxIcon.Error);
}
