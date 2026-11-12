using System.Net;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Vistara.Api.Hubs;
using Vistara.Api.Middleware;
using Vistara.Infrastructure.Data;
using Vistara.Infrastructure.Security;
using Vistara.MediaEngine;
using Vistara.Services.Backup;
using Vistara.Services.Integrity;
using Vistara.Services.Metadata;
using Vistara.Services.Music;
using Vistara.Services.Playback;
using Vistara.Services.Scanning;
using Vistara.Services.Search;
using Vistara.Services.Settings;
using Vistara.Services.Tasks;

// Configure Serilog structured logging
var appDataDir = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "Vistara");
var logsDir = Path.Combine(appDataDir, "logs");
Directory.CreateDirectory(logsDir);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File(Path.Combine(logsDir, "vistara_.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .CreateLogger();

try
{
    Log.Information("Starting Vistara Personal Media Universe backend...");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // Resolve static web root path across development, published server, and root run modes
    var baseDir = AppDomain.CurrentDomain.BaseDirectory;
    var webRootCandidates = new[]
    {
        Path.Combine(baseDir, "wwwroot"),
        Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
        Path.Combine(Directory.GetCurrentDirectory(), "src", "backend", "Vistara.Api", "wwwroot"),
        Path.Combine(baseDir, "..", "server", "wwwroot"),
        Path.Combine(baseDir, "..", "..", "..", "..", "backend", "Vistara.Api", "wwwroot")
    };
    foreach (var candidate in webRootCandidates)
    {
        if (Directory.Exists(candidate))
        {
            builder.Environment.WebRootPath = Path.GetFullPath(candidate);
            break;
        }
    }

    // Enforce 127.0.0.1 binding only - NEVER 0.0.0.0 or public interfaces
    int backendPort = 5178;
    if (args.Length > 0 && int.TryParse(args[0], out var customPort))
    {
        backendPort = customPort;
    }

    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Listen(IPAddress.Loopback, backendPort);
    });

    // Database configuration
    var dbDir = Path.Combine(appDataDir, "data");
    Directory.CreateDirectory(dbDir);
    var dbPath = Path.Combine(dbDir, "vistara.db");

    builder.Services.AddDbContext<VistaraDbContext>(options =>
    {
        options.UseSqlite($"Data Source={dbPath}");
    });

    // Register Infrastructure & Security
    builder.Services.AddSingleton<ILocalSecurityService, LocalSecurityService>();
    builder.Services.AddScoped<IPathSecurityValidator, PathSecurityValidator>();

    // Register MediaEngine
    builder.Services.AddSingleton<IFFmpegRunner, FFmpegRunner>();
    builder.Services.AddSingleton<IFFprobeAnalyzer, FFprobeAnalyzer>();
    builder.Services.AddSingleton<IHardwareAccelerationService, HardwareAccelerationService>();
    builder.Services.AddSingleton<IThumbnailService, ThumbnailService>();
    builder.Services.AddSingleton<ITranscoderService, TranscoderService>();
    builder.Services.AddSingleton<ISubtitleService, SubtitleService>();

    // Register Services
    builder.Services.AddScoped<ILibraryScannerService, LibraryScannerService>();
    builder.Services.AddScoped<IPlaybackService, PlaybackService>();
    builder.Services.AddScoped<IFtsSearchService, FtsSearchService>();
    builder.Services.AddScoped<IBackupService, BackupService>();
    builder.Services.AddScoped<ISettingsService, SettingsService>();
    builder.Services.AddScoped<IIntegrityService, IntegrityService>();
    builder.Services.AddHttpClient<ILyricsService, LyricsService>();
    builder.Services.AddHttpClient<IMusicArtworkService, MusicArtworkService>();
    builder.Services.AddHttpClient<IMoviePosterService, MoviePosterService>();

    // Register Background Task Manager as both hosted service and singleton
    builder.Services.AddSingleton<BackgroundTaskManager>();
    builder.Services.AddSingleton<IBackgroundTaskManager>(sp => sp.GetRequiredService<BackgroundTaskManager>());
    builder.Services.AddHostedService(sp => sp.GetRequiredService<BackgroundTaskManager>());

    // Controllers & SignalR with string enum serialization
    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        });
    builder.Services.AddSignalR();

    // CORS for localhost and WebView2
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("LocalPolicy", policy =>
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return true;
                try
                {
                    var uri = new Uri(origin);
                    return uri.Host == "localhost" || uri.Host == "127.0.0.1" || uri.Scheme == "app";
                }
                catch
                {
                    return false;
                }
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
        });
    });

    var app = builder.Build();

    // Apply security middleware
    app.UseMiddleware<LocalSecurityMiddleware>();
    app.UseCors("LocalPolicy");

    // Static files and SPA fallback
    app.UseDefaultFiles();
    app.UseStaticFiles();

    app.MapControllers();
    app.MapHub<VistaraHub>("/hubs/vistara");

    // SPA fallback to index.html for client-side routing
    app.MapFallbackToFile("index.html");

    // Initialize database
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();
        await DbInitializer.InitializeAsync(db);

        // Clean up Anime library if previously registered
        try
        {
            await db.Database.ExecuteSqlRawAsync(@"
                PRAGMA foreign_keys = OFF;
                DELETE FROM Episodes WHERE MediaItemId IN (SELECT Id FROM MediaItems WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6));
                DELETE FROM TVShows WHERE MediaItemId IN (SELECT Id FROM MediaItems WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6));
                DELETE FROM Movies WHERE MediaItemId IN (SELECT Id FROM MediaItems WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6));
                DELETE FROM MediaFiles WHERE MediaItemId IN (SELECT Id FROM MediaItems WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6));
                DELETE FROM Artworks WHERE MediaItemId IN (SELECT Id FROM MediaItems WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6));
                DELETE FROM MediaItems WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6);
                DELETE FROM LibraryFolders WHERE LibraryId IN (SELECT Id FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6);
                DELETE FROM Libraries WHERE Name = 'Anime Universe' OR Type = 6;
                PRAGMA foreign_keys = ON;
            ");
            Log.Information("Cleaned up Anime libraries and associated records from database.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to clean up Anime libraries from database.");
        }
    }

    Log.Information("Vistara backend successfully initialized on http://127.0.0.1:{Port}", backendPort);
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Vistara backend terminated unexpectedly.");
}
finally
{
    Log.CloseAndFlush();
}

