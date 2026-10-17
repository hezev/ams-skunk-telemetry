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
    private readonly TelemetryPipeline telemetry = new();
    private readonly string dataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AMS", "SkunkTelemetry", "WebView2");

    public MainForm()
    {
        Text = "AMS Skunk Telemetry — Desktop";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1050, 650);
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(7, 9, 12);
        Controls.Add(browser);
        Controls.Add(statusLabel);
        telemetry.Status += UpdateStatus;
        Shown += async (_, _) => await InitializeAsync();
        FormClosing += (_, _) => telemetry.Dispose();
    }

    private void UpdateStatus(string message)
    {
        if (IsDisposed || !IsHandleCreated) return;
        try
        {
            if (InvokeRequired) BeginInvoke(() => { if (!IsDisposed) statusLabel.Text = message; });
            else statusLabel.Text = message;
        }
        catch (InvalidOperationException) { }
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
            core.WebMessageReceived += (_, e) =>
            {
                if (!IsLocalUrl(e.Source)) return;
                try
                {
                    using var data = JsonDocument.Parse(e.WebMessageAsJson);
                    var root = data.RootElement;
                    if (root.ValueKind != JsonValueKind.Object ||
                        !root.TryGetProperty("kind", out var kind) ||
                        kind.GetString() != "ams.desktop.session") return;
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
        }
        catch (Exception ex)
        {
            ShowError("Não foi possível iniciar o WebView2: " + ex.Message);
        }
    }

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
