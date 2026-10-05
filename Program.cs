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
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        if (app.Environment.IsDevelopment())
        {
            ctx.Context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
            ctx.Context.Response.Headers.Pragma = "no-cache";
            ctx.Context.Response.Headers.Expires = "0";
        }
    }
});

app.MapGet("/api/health", () => Results.Ok(new
{
    service = "AMS Skunk Telemetry",
    status = "ok",
    contentRoot,
    webRoot = app.Environment.WebRootPath,
    utc = DateTime.UtcNow
}));

app.Run();
