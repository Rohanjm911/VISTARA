using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Vistara.Api.Hubs;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.Services.Scanning;
using Vistara.Services.Tasks;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class LibrariesController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly IBackgroundTaskManager _taskManager;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<VistaraHub, IVistaraClient> _hubContext;

    public LibrariesController(
        VistaraDbContext context,
        IBackgroundTaskManager taskManager,
        IServiceScopeFactory scopeFactory,
        IHubContext<VistaraHub, IVistaraClient> hubContext)
    {
        _context = context;
        _taskManager = taskManager;
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetLibraries()
    {
        var libraries = await _context.Libraries
            .Include(l => l.Folders)
            .Include(l => l.MediaItems)
                .ThenInclude(m => m.Files)
            .ToListAsync();

        var result = libraries.Select(l => new LibraryDto
        {
            Id = l.Id,
            Name = l.Name,
            Type = l.Type,
            Description = l.Description,
            Icon = l.Icon,
            AutoScanEnabled = l.AutoScanEnabled,
            ScanIntervalMinutes = l.ScanIntervalMinutes,
            ItemCount = (l.Type == LibraryType.TVShows)
                ? l.MediaItems.Count(m => m.Type == MediaType.Custom || m.Type == MediaType.Episode)
                : l.MediaItems.Count,
            TotalSizeBytes = l.MediaItems.SelectMany(m => m.Files).Sum(f => f.FileSizeBytes),
            LastScannedUtc = l.Folders.Where(f => f.LastScannedUtc.HasValue).Select(f => f.LastScannedUtc).DefaultIfEmpty().Max(),
            Folders = l.Folders.Select(f => new LibraryFolderDto
            {
                Id = f.Id,
                LibraryId = f.LibraryId,
                Path = f.Path,
                IsMonitored = f.IsMonitored,
                LastScannedUtc = f.LastScannedUtc,
                IsAccessible = f.IsAccessible
            }).ToList()
        }).ToList();

        return Ok(ApiResponse<List<LibraryDto>>.Ok(result));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetLibrary(Guid id)
    {
        var l = await _context.Libraries
            .Include(l => l.Folders)
            .Include(l => l.MediaItems)
                .ThenInclude(m => m.Files)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (l == null) return NotFound(ApiResponse<LibraryDto>.Fail("Library not found"));

        var dto = new LibraryDto
        {
            Id = l.Id,
            Name = l.Name,
            Type = l.Type,
            Description = l.Description,
            Icon = l.Icon,
            AutoScanEnabled = l.AutoScanEnabled,
            ScanIntervalMinutes = l.ScanIntervalMinutes,
            ItemCount = l.MediaItems.Count,
            TotalSizeBytes = l.MediaItems.SelectMany(m => m.Files).Sum(f => f.FileSizeBytes),
            LastScannedUtc = l.Folders.Max(f => f.LastScannedUtc),
            Folders = l.Folders.Select(f => new LibraryFolderDto
            {
                Id = f.Id,
                LibraryId = f.LibraryId,
                Path = f.Path,
                IsMonitored = f.IsMonitored,
                LastScannedUtc = f.LastScannedUtc,
                IsAccessible = f.IsAccessible
            }).ToList()
        };

        return Ok(ApiResponse<LibraryDto>.Ok(dto));
    }

    [HttpPost]
    public async Task<IActionResult> CreateLibrary([FromBody] CreateLibraryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(ApiResponse<LibraryDto>.Fail("Library name cannot be empty"));

        var library = new Library
        {
            Name = request.Name,
            Type = request.Type,
            Description = request.Description,
            Icon = request.Icon,
            AutoScanEnabled = request.AutoScanEnabled,
            ScanIntervalMinutes = request.ScanIntervalMinutes > 0 ? request.ScanIntervalMinutes : 60
        };

        if (request.FolderPaths != null)
        {
            foreach (var path in request.FolderPaths.Where(p => !string.IsNullOrWhiteSpace(p)))
            {
                library.Folders.Add(new LibraryFolder
                {
                    Path = Path.GetFullPath(path.Trim()),
                    IsMonitored = true,
                    IsAccessible = Directory.Exists(path.Trim())
                });
            }
        }

        _context.Libraries.Add(library);
        await _context.SaveChangesAsync();

        // Automatically enqueue initial scan
        var libId = library.Id;
        var libName = library.Name;
        _taskManager.EnqueueJob(JobType.LibraryScan, async (ct, p) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var scanner = scope.ServiceProvider.GetRequiredService<ILibraryScannerService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<VistaraHub, IVistaraClient>>();
            var progress = new Progress<ScanProgressDto>(dto =>
            {
                hubContext.Clients.All.ScanProgress(dto);
            });
            await scanner.ScanLibraryAsync(libId, ScanMode.Manual, progress, ct);
        }, $"Initial scan of {libName}");

        return Ok(ApiResponse<object>.Ok(new { library.Id, library.Name }, "Library created successfully"));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateLibrary(Guid id, [FromBody] UpdateLibraryRequest request)
    {
        var library = await _context.Libraries.FirstOrDefaultAsync(l => l.Id == id);
        if (library == null) return NotFound(ApiResponse<bool>.Fail("Library not found"));

        if (!string.IsNullOrWhiteSpace(request.Name)) library.Name = request.Name;
        library.Description = request.Description;
        library.Icon = request.Icon;
        library.AutoScanEnabled = request.AutoScanEnabled;
        library.ScanIntervalMinutes = request.ScanIntervalMinutes;
        library.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true, "Library updated"));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteLibrary(Guid id)
    {
        var library = await _context.Libraries
            .Include(l => l.Folders)
            .Include(l => l.MediaItems)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (library == null) return NotFound(ApiResponse<bool>.Fail("Library not found"));

        _context.Libraries.Remove(library);
        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true, "Library deleted"));
    }

    [HttpPost("{id}/folders")]
    public async Task<IActionResult> AddFolder(Guid id, [FromBody] AddFolderRequest request)
    {
        var library = await _context.Libraries.Include(l => l.Folders).FirstOrDefaultAsync(l => l.Id == id);
        if (library == null) return NotFound(ApiResponse<bool>.Fail("Library not found"));

        if (string.IsNullOrWhiteSpace(request.Path))
            return BadRequest(ApiResponse<bool>.Fail("Folder path cannot be empty"));

        var normalized = Path.GetFullPath(request.Path.Trim());
        if (library.Folders.Any(f => f.Path.Equals(normalized, StringComparison.OrdinalIgnoreCase)))
            return BadRequest(ApiResponse<bool>.Fail("Folder already added to this library"));

        var folder = new LibraryFolder
        {
            LibraryId = id,
            Path = normalized,
            IsMonitored = request.IsMonitored,
            IsAccessible = Directory.Exists(normalized)
        };
        _context.LibraryFolders.Add(folder);
        await _context.SaveChangesAsync();

        // Automatically enqueue scan when new folder is added
        var libId = library.Id;
        var libName = library.Name;
        _taskManager.EnqueueJob(JobType.LibraryScan, async (ct, p) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var scanner = scope.ServiceProvider.GetRequiredService<ILibraryScannerService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<VistaraHub, IVistaraClient>>();
            var progress = new Progress<ScanProgressDto>(dto =>
            {
                hubContext.Clients.All.ScanProgress(dto);
            });
            await scanner.ScanLibraryAsync(libId, ScanMode.Manual, progress, ct);
        }, $"Scanning newly added folder in {libName}");

        return Ok(ApiResponse<LibraryFolderDto>.Ok(new LibraryFolderDto
        {
            Id = folder.Id,
            LibraryId = folder.LibraryId,
            Path = folder.Path,
            IsMonitored = folder.IsMonitored,
            IsAccessible = folder.IsAccessible
        }, "Folder added successfully"));
    }

    [HttpDelete("{id}/folders/{folderId}")]
    public async Task<IActionResult> RemoveFolder(Guid id, Guid folderId)
    {
        var folder = await _context.LibraryFolders.FirstOrDefaultAsync(f => f.LibraryId == id && f.Id == folderId);
        if (folder == null) return NotFound(ApiResponse<bool>.Fail("Folder not found"));

        _context.LibraryFolders.Remove(folder);
        await _context.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true, "Folder removed from library"));
    }

    [HttpPost("{id}/scan")]
    public async Task<IActionResult> TriggerScan(Guid id)
    {
        var library = await _context.Libraries.FirstOrDefaultAsync(l => l.Id == id);
        if (library == null) return NotFound(ApiResponse<bool>.Fail("Library not found"));

        var libId = library.Id;
        var libName = library.Name;
        var jobId = _taskManager.EnqueueJob(JobType.LibraryScan, async (ct, p) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var scanner = scope.ServiceProvider.GetRequiredService<ILibraryScannerService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<VistaraHub, IVistaraClient>>();
            var progress = new Progress<ScanProgressDto>(dto =>
            {
                hubContext.Clients.All.ScanProgress(dto);
            });
            await scanner.ScanLibraryAsync(libId, ScanMode.Manual, progress, ct);
        }, $"Scanning {libName}");

        return Ok(ApiResponse<object>.Ok(new { JobId = jobId }, "Scan queued successfully"));
    }
}

public class CreateLibraryRequest
{
    public string Name { get; set; } = string.Empty;
    public LibraryType Type { get; set; } = LibraryType.Movies;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public bool AutoScanEnabled { get; set; } = true;
    public int ScanIntervalMinutes { get; set; } = 60;
    public List<string>? FolderPaths { get; set; }
}

public class UpdateLibraryRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public bool AutoScanEnabled { get; set; }
    public int ScanIntervalMinutes { get; set; }
}

public class AddFolderRequest
{
    public string Path { get; set; } = string.Empty;
    public bool IsMonitored { get; set; } = true;
}
