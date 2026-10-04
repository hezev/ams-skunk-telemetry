var currentDirectory = Directory.GetCurrentDirectory();

string contentRoot;

if (Directory.Exists(Path.Combine(currentDirectory, "wwwroot")))
{
    contentRoot = currentDirectory;
}
else
{
    // Visual Studio can launch the compiled executable from bin/Debug/netX.
    // Walk back to the project root so static files are still found.
    contentRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."));
}

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot,
    WebRootPath = Path.Combine(contentRoot, "wwwroot")
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new
{
    service = "AMS Skunk Telemetry",
    status = "ok",
    contentRoot,
    webRoot = app.Environment.WebRootPath,
    utc = DateTime.UtcNow
}));

app.Run();
