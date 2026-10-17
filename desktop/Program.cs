using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Drawing;

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
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };
    private readonly string dataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "AMS", "SkunkTelemetry", "WebView2");
    private const string Home = "https://ams-telemetry.local/index.html";

    public MainForm()
    {
        Text = "AMS Skunk Telemetry";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(1050, 650);
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(7, 9, 12);
        Controls.Add(browser);
        Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        var assetDirectory = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (!File.Exists(Path.Combine(assetDirectory, "index.html")))
        {
            ShowError("Os ficheiros da interface não foram encontrados. Reinstala a aplicação.");
            return;
        }

        try
        {
            Directory.CreateDirectory(dataFolder);
            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: dataFolder);
            await browser.EnsureCoreWebView2Async(env);
            browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "ams-telemetry.local", assetDirectory, CoreWebView2HostResourceAccessKind.Allow);
            browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            browser.CoreWebView2.NewWindowRequested += (_, e) =>
            {
                // Preserve OAuth and external links in the normal browser.
                e.Handled = true;
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var url)
                    && (url.Scheme == Uri.UriSchemeHttps || url.Scheme == Uri.UriSchemeHttp))
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url.AbsoluteUri)
                    { UseShellExecute = true });
            };
            browser.Source = new Uri(Home);
        }
        catch (Exception ex)
        {
            ShowError("Não foi possível iniciar o motor WebView2. Instala o Microsoft Edge WebView2 Runtime.\n\n" + ex.Message);
        }
    }

    private void ShowError(string message)
    {
        MessageBox.Show(this, message, "AMS Skunk Telemetry", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
