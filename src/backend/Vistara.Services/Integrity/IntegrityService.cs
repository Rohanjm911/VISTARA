using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.Infrastructure.Security;
using Vistara.MediaEngine;
using Vistara.Services.Tasks;

namespace Vistara.Services.Integrity;

public class IntegrityService : IIntegrityService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IFFprobeAnalyzer _ffprobe;
    private readonly IFFmpegRunner _ffmpegRunner;
    private readonly IBackgroundTaskManager _taskManager;
    private readonly ILogger<IntegrityService> _logger;

    // Active scan coordination
    private static readonly object _scanLock = new();
    private static Guid? _currentScanId;
    private static CancellationTokenSource? _scanCts;
    private static ManualResetEventSlim _scanPauseEvent = new(true);
    private static volatile bool _isScanRunning = false;

    // Callbacks for SignalR / notification hooks
    public static event Action<IntegrityScanProgressDto>? OnScanProgress;
    public static event Action<IntegrityFileRecordDto>? OnIssueDetected;
    public static event Action<IntegrityScanDto>? OnScanCompleted;

    public IntegrityService(
        IServiceScopeFactory scopeFactory,
        IFFprobeAnalyzer ffprobe,
        IFFmpegRunner ffmpegRunner,
        IBackgroundTaskManager taskManager,
        ILogger<IntegrityService> logger)
    {
        _scopeFactory = scopeFactory;
        _ffprobe = ffprobe;
        _ffmpegRunner = ffmpegRunner;
        _taskManager = taskManager;
        _logger = logger;
    }

    public async Task<IntegrityDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var totalFilesMonitored = await context.MediaFiles.CountAsync(cancellationToken);
        var records = await context.IntegrityFileRecords.ToListAsync(cancellationToken);

        var healthy = records.Count(r => r.Status == IntegrityFileStatus.Healthy);
        var modified = records.Count(r => r.Status == IntegrityFileStatus.Modified);
        var missing = records.Count(r => r.Status == IntegrityFileStatus.Missing);
        var corrupted = records.Count(r => r.Status == IntegrityFileStatus.Corrupted);
        var unreadable = records.Count(r => r.Status == IntegrityFileStatus.Unreadable);
        var driveDisconnected = records.Count(r => r.Status == IntegrityFileStatus.DriveDisconnected);
        var pending = Math.Max(0, totalFilesMonitored - records.Count) + records.Count(r => r.Status == IntegrityFileStatus.PendingVerification);

        var totalVerifiedSize = records
            .Where(r => r.Status == IntegrityFileStatus.Healthy || r.Status == IntegrityFileStatus.Modified)
            .Sum(r => r.FileSizeBytes);

        var coverage = totalFilesMonitored > 0
            ? Math.Min(100.0, Math.Round((double)records.Count(r => r.Status != IntegrityFileStatus.PendingVerification) / totalFilesMonitored * 100, 1))
            : 0;

        var lastScan = await context.IntegrityScans
            .OrderByDescending(s => s.StartedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        IntegrityScanDto? currentScanDto = null;
        if (_isScanRunning && _currentScanId.HasValue)
        {
            var activeScan = await context.IntegrityScans.FindAsync(new object[] { _currentScanId.Value }, cancellationToken);
            if (activeScan != null) currentScanDto = MapScanToDto(activeScan);
        }

        var recentEvents = await context.IntegrityEvents
            .OrderByDescending(e => e.TimestampUtc)
            .Take(15)
            .Select(e => new IntegrityEventDto
            {
                Id = e.Id,
                TimestampUtc = e.TimestampUtc,
                EventType = e.EventType,
                Severity = e.Severity,
                Title = e.Title,
                Description = e.Description,
                FilePath = e.FilePath,
                MediaFileId = e.MediaFileId,
                Resolved = e.Resolved,
                ResolvedAtUtc = e.ResolvedAtUtc
            })
            .ToListAsync(cancellationToken);

        return new IntegrityDashboardDto
        {
            TotalFilesMonitored = totalFilesMonitored,
            HealthyFiles = healthy,
            ModifiedFiles = modified,
            MissingFiles = missing,
            CorruptedFiles = corrupted,
            UnreadableFiles = unreadable,
            DriveDisconnectedFiles = driveDisconnected,
            PendingVerificationFiles = pending,
            CoveragePercentage = coverage,
            TotalVerifiedSizeBytes = totalVerifiedSize,
            LastScanTimestampUtc = lastScan?.CompletedAtUtc ?? lastScan?.StartedAtUtc,
            LastScanStatus = lastScan?.Status.ToString(),
            IsScanRunning = _isScanRunning,
            CurrentScan = currentScanDto,
            RecentEvents = recentEvents
        };
    }

    public async Task<List<IntegrityScanDto>> GetScansAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var scans = await context.IntegrityScans
            .Include(s => s.Library)
            .OrderByDescending(s => s.StartedAtUtc)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return scans.Select(MapScanToDto).ToList();
    }

    public async Task<IntegrityScanDto?> GetScanByIdAsync(Guid scanId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var scan = await context.IntegrityScans
            .Include(s => s.Library)
            .FirstOrDefaultAsync(s => s.Id == scanId, cancellationToken);

        return scan == null ? null : MapScanToDto(scan);
    }

    public async Task<IntegrityScanDto> StartScanAsync(StartIntegrityScanRequest request, string triggeredBy = "Manual", CancellationToken cancellationToken = default)
    {
        lock (_scanLock)
        {
            if (_isScanRunning && _currentScanId.HasValue)
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();
                var runningScan = context.IntegrityScans.Find(_currentScanId.Value);
                if (runningScan != null) return MapScanToDto(runningScan);
            }

            _isScanRunning = true;
            _scanCts = new CancellationTokenSource();
            _scanPauseEvent = new ManualResetEventSlim(true);
        }

        var scanType = Enum.TryParse<IntegrityScanType>(request.ScanType, true, out var parsedType)
            ? parsedType
            : IntegrityScanType.Incremental;

        var scan = new IntegrityScan
        {
            LibraryId = request.LibraryId,
            ScanType = scanType,
            Status = IntegrityScanStatus.Running,
            StartedAtUtc = DateTime.UtcNow,
            TriggeredBy = triggeredBy,
            VerifyHash = request.VerifyHash,
            RunFfprobe = request.RunFfprobe
        };

        using (var scope = _scopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();
            context.IntegrityScans.Add(scan);

            context.IntegrityEvents.Add(new IntegrityEvent
            {
                EventType = IntegrityEventType.ScanStarted,
                Severity = "Info",
                Title = "Media Integrity Scan Started",
                Description = $"{scanType} integrity verification started ({triggeredBy})."
            });

            await context.SaveChangesAsync(cancellationToken);
            _currentScanId = scan.Id;
        }

        // Run background verification task
        _ = Task.Run(() => ExecuteIntegrityScanAsync(scan.Id, _scanCts.Token));

        return MapScanToDto(scan);
    }

    public bool PauseScan(Guid scanId)
    {
        lock (_scanLock)
        {
            if (_isScanRunning && _currentScanId == scanId)
            {
                _scanPauseEvent.Reset();
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();
                var scan = context.IntegrityScans.Find(scanId);
                if (scan != null)
                {
                    scan.Status = IntegrityScanStatus.Paused;
                    context.SaveChanges();
                }
                return true;
            }
        }
        return false;
    }

    public bool ResumeScan(Guid scanId)
    {
        lock (_scanLock)
        {
            if (_isScanRunning && _currentScanId == scanId)
            {
                _scanPauseEvent.Set();
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();
                var scan = context.IntegrityScans.Find(scanId);
                if (scan != null)
                {
                    scan.Status = IntegrityScanStatus.Running;
                    context.SaveChanges();
                }
                return true;
            }
        }
        return false;
    }

    public bool CancelScan(Guid scanId)
    {
        lock (_scanLock)
        {
            if (_isScanRunning && _currentScanId == scanId)
            {
                _scanCts?.Cancel();
                _scanPauseEvent.Set(); // unblock if paused
                return true;
            }
        }
        return false;
    }

    public async Task<IntegrityFileRecordDto> VerifySingleFileAsync(Guid mediaFileId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var mediaFile = await context.MediaFiles
            .Include(f => f.MediaItem)
            .FirstOrDefaultAsync(f => f.Id == mediaFileId, cancellationToken);

        if (mediaFile == null)
            throw new ArgumentException($"Media file with ID '{mediaFileId}' was not found.");

        var settings = await GetSettingsAsync(cancellationToken);
        var result = await VerifyMediaFileInternalAsync(context, mediaFile, null, settings, verifyHash: true, runFfprobe: true, cancellationToken);

        await context.SaveChangesAsync(cancellationToken);
        return MapFileRecordToDto(result, mediaFile.MediaItem?.Title);
    }

    public async Task<List<IntegrityVerificationHistoryDto>> GetFileHistoryAsync(Guid mediaFileId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var histories = await context.IntegrityVerificationHistories
            .Where(h => h.MediaFileId == mediaFileId)
            .OrderByDescending(h => h.VerifiedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        return histories.Select(h => new IntegrityVerificationHistoryDto
        {
            Id = h.Id,
            IntegrityScanId = h.IntegrityScanId,
            MediaFileId = h.MediaFileId,
            FilePath = h.FilePath,
            VerifiedAtUtc = h.VerifiedAtUtc,
            ResultStatus = h.ResultStatus,
            PreviousHash = h.PreviousHash,
            CurrentHash = h.CurrentHash,
            PreviousSize = h.PreviousSize,
            CurrentSize = h.CurrentSize,
            DurationMs = h.DurationMs,
            ErrorDetails = h.ErrorDetails,
            CheckType = h.CheckType
        }).ToList();
    }

    public async Task<PagedResult<IntegrityFileRecordDto>> GetIssuesAsync(
        IntegrityFileStatus? status,
        Guid? libraryId,
        string? search,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var query = context.IntegrityFileRecords
            .Include(r => r.MediaItem)
            .Include(r => r.Library)
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }
        else
        {
            // Default to all issues (non-healthy)
            query = query.Where(r => r.Status != IntegrityFileStatus.Healthy && r.Status != IntegrityFileStatus.PendingVerification);
        }

        if (libraryId.HasValue && libraryId.Value != Guid.Empty)
        {
            query = query.Where(r => r.LibraryId == libraryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(r => r.FilePath.ToLower().Contains(q) ||
                                     (r.MediaItem != null && r.MediaItem.Title.ToLower().Contains(q)) ||
                                     (r.CorruptionReason != null && r.CorruptionReason.ToLower().Contains(q)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(r => r.Status == IntegrityFileStatus.Corrupted)
            .ThenByDescending(r => r.Status == IntegrityFileStatus.Unreadable)
            .ThenByDescending(r => r.Status == IntegrityFileStatus.Modified)
            .ThenByDescending(r => r.LastVerifiedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(r => MapFileRecordToDto(r, r.MediaItem?.Title, r.Library?.Name)).ToList();
        return new PagedResult<IntegrityFileRecordDto>(dtos, total, page, pageSize);
    }

    public async Task<bool> RelinkFileAsync(Guid mediaFileId, string newPath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(newPath) || !File.Exists(newPath))
            throw new ArgumentException("The specified replacement file does not exist on disk.");

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();
        var pathSecurity = scope.ServiceProvider.GetRequiredService<IPathSecurityValidator>();

        if (!await pathSecurity.IsPathAllowedAsync(newPath, cancellationToken))
            throw new UnauthorizedAccessException("The selected file location is not within an authorized library folder.");

        var mediaFile = await context.MediaFiles
            .Include(f => f.MediaItem)
            .Include(f => f.LibraryFolder)
            .FirstOrDefaultAsync(f => f.Id == mediaFileId, cancellationToken);

        if (mediaFile == null)
            throw new ArgumentException($"Media file with ID '{mediaFileId}' was not found.");

        var oldPath = mediaFile.AbsolutePath;
        var fileInfo = new FileInfo(newPath);

        // Update MediaFile record
        mediaFile.AbsolutePath = newPath;
        if (mediaFile.LibraryFolder != null && newPath.StartsWith(mediaFile.LibraryFolder.Path, StringComparison.OrdinalIgnoreCase))
        {
            mediaFile.RelativePath = Path.GetRelativePath(mediaFile.LibraryFolder.Path, newPath);
        }
        mediaFile.FileSizeBytes = fileInfo.Length;
        mediaFile.IsMissing = false;
        mediaFile.MissingSinceUtc = null;

        // Perform immediate verification
        var settings = await GetSettingsAsync(cancellationToken);
        var record = await VerifyMediaFileInternalAsync(context, mediaFile, null, settings, verifyHash: true, runFfprobe: true, cancellationToken);

        // Log relink event
        context.IntegrityEvents.Add(new IntegrityEvent
        {
            EventType = IntegrityEventType.FileRelinked,
            Severity = "Info",
            Title = "File Relinked Successfully",
            Description = $"Media file for '{mediaFile.MediaItem?.Title ?? Path.GetFileName(newPath)}' relinked from '{oldPath}' to '{newPath}'.",
            FilePath = newPath,
            MediaFileId = mediaFile.Id,
            Resolved = true,
            ResolvedAtUtc = DateTime.UtcNow
        });

        await context.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<RecoveryCandidateDto>> FindRecoveryCandidatesAsync(Guid mediaFileId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var mediaFile = await context.MediaFiles
            .Include(f => f.MediaItem)
            .Include(f => f.LibraryFolder)
            .FirstOrDefaultAsync(f => f.Id == mediaFileId, cancellationToken);

        if (mediaFile == null) return new List<RecoveryCandidateDto>();

        var originalFileName = Path.GetFileName(mediaFile.AbsolutePath);
        var originalNameNoExt = Path.GetFileNameWithoutExtension(mediaFile.AbsolutePath);
        var targetSize = mediaFile.FileSizeBytes;

        var libraryFolders = await context.LibraryFolders
            .Where(f => f.LibraryId == (mediaFile.MediaItem != null ? mediaFile.MediaItem.LibraryId : f.LibraryId))
            .Select(f => f.Path)
            .ToListAsync(cancellationToken);

        var candidates = new List<RecoveryCandidateDto>();

        foreach (var folder in libraryFolders)
        {
            if (!Directory.Exists(folder)) continue;

            try
            {
                var files = Directory.EnumerateFiles(folder, "*.*", SearchOption.AllDirectories);
                foreach (var filePath in files)
                {
                    if (filePath.Equals(mediaFile.AbsolutePath, StringComparison.OrdinalIgnoreCase)) continue;

                    var fi = new FileInfo(filePath);
                    var candidateName = fi.Name;
                    var candidateNoExt = Path.GetFileNameWithoutExtension(candidateName);

                    int score = 0;
                    bool sizeMatch = fi.Length == targetSize;

                    if (candidateName.Equals(originalFileName, StringComparison.OrdinalIgnoreCase))
                        score += 70;
                    else if (candidateNoExt.Equals(originalNameNoExt, StringComparison.OrdinalIgnoreCase))
                        score += 60;
                    else if (candidateNoExt.Contains(originalNameNoExt, StringComparison.OrdinalIgnoreCase) || originalNameNoExt.Contains(candidateNoExt, StringComparison.OrdinalIgnoreCase))
                        score += 40;

                    if (sizeMatch && targetSize > 0)
                        score += 35;
                    else if (targetSize > 0 && Math.Abs(fi.Length - targetSize) < 1024 * 1024)
                        score += 15;

                    if (score >= 40)
                    {
                        candidates.Add(new RecoveryCandidateDto
                        {
                            Path = filePath,
                            FileName = fi.Name,
                            FileSizeBytes = fi.Length,
                            LastModifiedUtc = fi.LastWriteTimeUtc,
                            ExactSizeMatch = sizeMatch,
                            ConfidenceScore = Math.Min(100, score)
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error scanning candidate folder {Folder}", folder);
            }
        }

        return candidates.OrderByDescending(c => c.ConfidenceScore).Take(20).ToList();
    }

    public async Task<byte[]> ExportReportAsync(string format, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var records = await context.IntegrityFileRecords
            .Include(r => r.MediaItem)
            .Include(r => r.Library)
            .OrderBy(r => r.Status)
            .ThenBy(r => r.FilePath)
            .ToListAsync(cancellationToken);

        if (string.Equals(format, "json", StringComparison.OrdinalIgnoreCase))
        {
            var exportList = records.Select(r => MapFileRecordToDto(r, r.MediaItem?.Title, r.Library?.Name)).ToList();
            var json = JsonSerializer.Serialize(exportList, new JsonSerializerOptions { WriteIndented = true });
            return Encoding.UTF8.GetBytes(json);
        }
        else
        {
            // Default CSV format
            var sb = new StringBuilder();
            sb.AppendLine("FilePath,Title,Library,Status,FileSizeBytes,PreviousFileSizeBytes,Sha256Hash,PreviousSha256Hash,CorruptionReason,LastVerifiedAtUtc");

            foreach (var r in records)
            {
                var title = (r.MediaItem?.Title ?? string.Empty).Replace("\"", "\"\"");
                var path = r.FilePath.Replace("\"", "\"\"");
                var lib = (r.Library?.Name ?? string.Empty).Replace("\"", "\"\"");
                var reason = (r.CorruptionReason ?? string.Empty).Replace("\"", "\"\"");

                sb.AppendLine($"\"{path}\",\"{title}\",\"{lib}\",{r.Status},{r.FileSizeBytes},{r.PreviousFileSizeBytes ?? 0},\"{r.Sha256Hash ?? ""}\",\"{r.PreviousSha256Hash ?? ""}\",\"{reason}\",\"{r.LastVerifiedAtUtc:O}\"");
            }

            return Encoding.UTF8.GetBytes(sb.ToString());
        }
    }

    public async Task<IntegritySettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        var settings = new IntegritySettingsDto();

        var strategySetting = await context.AppSettings.FindAsync(new object[] { "Integrity.VerificationStrategy" }, cancellationToken);
        if (strategySetting != null) settings.VerificationStrategy = strategySetting.Value;

        var prioritySetting = await context.AppSettings.FindAsync(new object[] { "Integrity.ScanPriority" }, cancellationToken);
        if (prioritySetting != null) settings.ScanPriority = prioritySetting.Value;

        var concurrencySetting = await context.AppSettings.FindAsync(new object[] { "Integrity.MaxConcurrency" }, cancellationToken);
        if (concurrencySetting != null && int.TryParse(concurrencySetting.Value, out var conc)) settings.MaxConcurrency = conc;

        var pauseSetting = await context.AppSettings.FindAsync(new object[] { "Integrity.PauseDuringPlayback" }, cancellationToken);
        if (pauseSetting != null && bool.TryParse(pauseSetting.Value, out var pause)) settings.PauseDuringPlayback = pause;

        var scheduleSetting = await context.AppSettings.FindAsync(new object[] { "Integrity.AutoSchedule" }, cancellationToken);
        if (scheduleSetting != null) settings.AutoSchedule = scheduleSetting.Value;

        var hourSetting = await context.AppSettings.FindAsync(new object[] { "Integrity.ScheduledHourUtc" }, cancellationToken);
        if (hourSetting != null && int.TryParse(hourSetting.Value, out var hour)) settings.ScheduledHourUtc = hour;

        var bufferSetting = await context.AppSettings.FindAsync(new object[] { "Integrity.HashBufferSizeKb" }, cancellationToken);
        if (bufferSetting != null && int.TryParse(bufferSetting.Value, out var buf)) settings.HashBufferSizeKb = buf;

        var deepSetting = await context.AppSettings.FindAsync(new object[] { "Integrity.ProbeDeepDecoding" }, cancellationToken);
        if (deepSetting != null && bool.TryParse(deepSetting.Value, out var deep)) settings.ProbeDeepDecoding = deep;

        var retentionSetting = await context.AppSettings.FindAsync(new object[] { "Integrity.HistoryRetentionDays" }, cancellationToken);
        if (retentionSetting != null && int.TryParse(retentionSetting.Value, out var ret)) settings.HistoryRetentionDays = ret;

        return settings;
    }

    public async Task<bool> UpdateSettingsAsync(IntegritySettingsDto settings, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<VistaraDbContext>();

        await SetAppSettingAsync(context, "Integrity.VerificationStrategy", settings.VerificationStrategy, cancellationToken);
        await SetAppSettingAsync(context, "Integrity.ScanPriority", settings.ScanPriority, cancellationToken);
        await SetAppSettingAsync(context, "Integrity.MaxConcurrency", settings.MaxConcurrency.ToString(), cancellationToken);
        await SetAppSettingAsync(context, "Integrity.PauseDuringPlayback", settings.PauseDuringPlayback.ToString().ToLower(), cancellationToken);
        await SetAppSettingAsync(context, "Integrity.AutoSchedule", settings.AutoSchedule, cancellationToken);
        await SetAppSettingAsync(context, "Integrity.ScheduledHourUtc", settings.ScheduledHourUtc.ToString(), cancellationToken);
        await SetAppSettingAsync(context, "Integrity.HashBufferSizeKb", settings.HashBufferSizeKb.ToString(), cancellationToken);
        await SetAppSettingAsync(context, "Integrity.ProbeDeepDecoding", settings.ProbeDeepDecoding.ToString().ToLower(), cancellationToken);
        await SetAppSettingAsync(context, "Integrity.HistoryRetentionDays", settings.HistoryRetentionDays.ToString(), cancellationToken);

        await context.SaveChangesAsync(cancellationToken);
        return true;
    }

    // =========================================================================
    // Core Background Scanning Execution Loop
    // =========================================================================

    private async Task ExecuteIntegrityScanAsync(Guid scanId, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        int healthyCount = 0;
        int modifiedCount = 0;
        int missingCount = 0;
        int corruptedCount = 0;
        int unreadableCount = 0;
        int driveDisconnectedCount = 0;
        long totalBytesScanned = 0;

        try
        {
            using var initScope = _scopeFactory.CreateScope();
            var initContext = initScope.ServiceProvider.GetRequiredService<VistaraDbContext>();

            var scan = await initContext.IntegrityScans.FindAsync(new object[] { scanId }, cancellationToken);
            if (scan == null) return;

            var settings = await GetSettingsAsync(cancellationToken);

            // Fetch target files
            var filesQuery = initContext.MediaFiles
                .Include(f => f.MediaItem)
                .AsNoTracking();

            if (scan.LibraryId.HasValue && scan.LibraryId.Value != Guid.Empty)
            {
                filesQuery = filesQuery.Where(f => f.MediaItem != null && f.MediaItem.LibraryId == scan.LibraryId.Value);
            }

            var mediaFiles = await filesQuery.ToListAsync(cancellationToken);
            scan.TotalFilesDiscovered = mediaFiles.Count;
            await initContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Integrity scan {ScanId} discovered {Count} files to verify", scanId, mediaFiles.Count);

            var semaphore = new SemaphoreSlim(Math.Max(1, Math.Min(4, settings.MaxConcurrency)));
            int processed = 0;
            DateTime lastProgressReport = DateTime.UtcNow;

            for (int i = 0; i < mediaFiles.Count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Handle Pause
                _scanPauseEvent.Wait(cancellationToken);

                // Playback Awareness
                if (settings.PauseDuringPlayback)
                {
                    while (CheckIfPlaybackActive() && !cancellationToken.IsCancellationRequested)
                    {
                        await Task.Delay(1500, cancellationToken);
                    }
                }

                var file = mediaFiles[i];

                await semaphore.WaitAsync(cancellationToken);
                try
                {
                    using var fileScope = _scopeFactory.CreateScope();
                    var fileContext = fileScope.ServiceProvider.GetRequiredService<VistaraDbContext>();

                    var verifiedRecord = await VerifyMediaFileInternalAsync(
                        fileContext,
                        file,
                        scanId,
                        settings,
                        scan.VerifyHash,
                        scan.RunFfprobe,
                        cancellationToken);

                    await fileContext.SaveChangesAsync(cancellationToken);

                    switch (verifiedRecord.Status)
                    {
                        case IntegrityFileStatus.Healthy:
                            Interlocked.Increment(ref healthyCount);
                            break;
                        case IntegrityFileStatus.Modified:
                            Interlocked.Increment(ref modifiedCount);
                            OnIssueDetected?.Invoke(MapFileRecordToDto(verifiedRecord, file.MediaItem?.Title));
                            break;
                        case IntegrityFileStatus.Missing:
                            Interlocked.Increment(ref missingCount);
                            OnIssueDetected?.Invoke(MapFileRecordToDto(verifiedRecord, file.MediaItem?.Title));
                            break;
                        case IntegrityFileStatus.Corrupted:
                            Interlocked.Increment(ref corruptedCount);
                            OnIssueDetected?.Invoke(MapFileRecordToDto(verifiedRecord, file.MediaItem?.Title));
                            break;
                        case IntegrityFileStatus.Unreadable:
                            Interlocked.Increment(ref unreadableCount);
                            OnIssueDetected?.Invoke(MapFileRecordToDto(verifiedRecord, file.MediaItem?.Title));
                            break;
                        case IntegrityFileStatus.DriveDisconnected:
                            Interlocked.Increment(ref driveDisconnectedCount);
                            OnIssueDetected?.Invoke(MapFileRecordToDto(verifiedRecord, file.MediaItem?.Title));
                            break;
                    }

                    Interlocked.Add(ref totalBytesScanned, verifiedRecord.FileSizeBytes);
                }
                finally
                {
                    semaphore.Release();
                }

                var currentProcessed = Interlocked.Increment(ref processed);

                // Throttled SignalR Progress notification
                if ((DateTime.UtcNow - lastProgressReport).TotalMilliseconds >= 350 || currentProcessed == mediaFiles.Count)
                {
                    lastProgressReport = DateTime.UtcNow;
                    var progressDto = new IntegrityScanProgressDto
                    {
                        ScanId = scanId,
                        Status = IntegrityScanStatus.Running,
                        CurrentFile = Path.GetFileName(file.AbsolutePath),
                        TotalFiles = mediaFiles.Count,
                        ProcessedFiles = currentProcessed,
                        PercentComplete = mediaFiles.Count > 0 ? Math.Round((double)currentProcessed / mediaFiles.Count * 100, 1) : 100,
                        HealthyCount = healthyCount,
                        IssueCount = modifiedCount + missingCount + corruptedCount + unreadableCount + driveDisconnectedCount
                    };
                    OnScanProgress?.Invoke(progressDto);
                }
            }

            sw.Stop();

            // Finalize scan in database
            using (var finalScope = _scopeFactory.CreateScope())
            {
                var finalContext = finalScope.ServiceProvider.GetRequiredService<VistaraDbContext>();
                var finalScan = await finalContext.IntegrityScans.FindAsync(new object[] { scanId });
                if (finalScan != null)
                {
                    finalScan.Status = IntegrityScanStatus.Completed;
                    finalScan.CompletedAtUtc = DateTime.UtcNow;
                    finalScan.FilesVerified = processed;
                    finalScan.FilesHealthy = healthyCount;
                    finalScan.FilesModified = modifiedCount;
                    finalScan.FilesMissing = missingCount;
                    finalScan.FilesCorrupted = corruptedCount;
                    finalScan.FilesUnreadable = unreadableCount;
                    finalScan.FilesDriveDisconnected = driveDisconnectedCount;
                    finalScan.TotalBytesScanned = totalBytesScanned;
                    finalScan.DurationMs = sw.ElapsedMilliseconds;

                    finalContext.IntegrityEvents.Add(new IntegrityEvent
                    {
                        EventType = IntegrityEventType.ScanCompleted,
                        Severity = (corruptedCount > 0 || unreadableCount > 0) ? "Warning" : "Info",
                        Title = "Media Integrity Scan Completed",
                        Description = $"Completed in {sw.Elapsed.TotalSeconds:F1}s. Verified: {processed}, Healthy: {healthyCount}, Issues: {modifiedCount + missingCount + corruptedCount + unreadableCount}."
                    });

                    await finalContext.SaveChangesAsync();
                    OnScanCompleted?.Invoke(MapScanToDto(finalScan));
                }
            }

            _logger.LogInformation("Integrity scan {ScanId} completed successfully in {Seconds}s", scanId, sw.Elapsed.TotalSeconds);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Integrity scan {ScanId} was cancelled by user.", scanId);
            using var cancelScope = _scopeFactory.CreateScope();
            var cancelContext = cancelScope.ServiceProvider.GetRequiredService<VistaraDbContext>();
            var cancelScan = await cancelContext.IntegrityScans.FindAsync(new object[] { scanId });
            if (cancelScan != null)
            {
                cancelScan.Status = IntegrityScanStatus.Cancelled;
                cancelScan.CompletedAtUtc = DateTime.UtcNow;
                cancelScan.DurationMs = sw.ElapsedMilliseconds;
                await cancelContext.SaveChangesAsync();
                OnScanCompleted?.Invoke(MapScanToDto(cancelScan));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Integrity scan {ScanId} failed.", scanId);
            using var errorScope = _scopeFactory.CreateScope();
            var errorContext = errorScope.ServiceProvider.GetRequiredService<VistaraDbContext>();
            var errorScan = await errorContext.IntegrityScans.FindAsync(new object[] { scanId });
            if (errorScan != null)
            {
                errorScan.Status = IntegrityScanStatus.Failed;
                errorScan.CompletedAtUtc = DateTime.UtcNow;
                errorScan.ErrorMessage = ex.Message;
                errorScan.DurationMs = sw.ElapsedMilliseconds;

                errorContext.IntegrityEvents.Add(new IntegrityEvent
                {
                    EventType = IntegrityEventType.ScanFailed,
                    Severity = "Error",
                    Title = "Media Integrity Scan Failed",
                    Description = $"Scan failed: {ex.Message}"
                });

                await errorContext.SaveChangesAsync();
                OnScanCompleted?.Invoke(MapScanToDto(errorScan));
            }
        }
        finally
        {
            lock (_scanLock)
            {
                _isScanRunning = false;
                _currentScanId = null;
            }
        }
    }

    // =========================================================================
    // Single Media File Verification Engine
    // =========================================================================

    private async Task<IntegrityFileRecord> VerifyMediaFileInternalAsync(
        VistaraDbContext context,
        MediaFile mediaFile,
        Guid? scanId,
        IntegritySettingsDto settings,
        bool verifyHash,
        bool runFfprobe,
        CancellationToken cancellationToken)
    {
        var fileSw = Stopwatch.StartNew();
        var filePath = mediaFile.AbsolutePath;
        var driveRoot = Path.GetPathRoot(filePath) ?? string.Empty;

        var existingRecord = await context.IntegrityFileRecords
            .FirstOrDefaultAsync(r => r.FilePath == filePath, cancellationToken);

        var record = existingRecord ?? new IntegrityFileRecord
        {
            MediaFileId = mediaFile.Id,
            MediaItemId = mediaFile.MediaItemId,
            LibraryId = mediaFile.MediaItem?.LibraryId ?? Guid.Empty,
            FilePath = filePath,
            DriveRoot = driveRoot
        };

        if (record.LibraryId == Guid.Empty && mediaFile.MediaItem != null)
        {
            record.LibraryId = mediaFile.MediaItem.LibraryId;
        }

        record.DriveRoot = driveRoot;

        // 1. Check Drive Accessibility
        bool isDriveAccessible = string.IsNullOrEmpty(driveRoot) || Directory.Exists(driveRoot);
        record.IsDriveAccessible = isDriveAccessible;

        if (!isDriveAccessible)
        {
            // CRITICAL: A disconnected drive must NEVER be classified as missing / deleted!
            record.Status = IntegrityFileStatus.DriveDisconnected;
            record.CorruptionReason = $"Drive or mount volume '{driveRoot}' is currently inaccessible or disconnected.";
            record.LastVerifiedAtUtc = DateTime.UtcNow;
            record.FailureCount++;

            AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.DriveDisconnected, record.Sha256Hash, record.Sha256Hash, record.FileSizeBytes, record.FileSizeBytes, fileSw.ElapsedMilliseconds, record.CorruptionReason, "DriveCheck");
            return record;
        }

        // 2. Check File Existence
        if (!File.Exists(filePath))
        {
            record.Status = IntegrityFileStatus.Missing;
            record.CorruptionReason = "File was not found in the library path.";
            record.LastVerifiedAtUtc = DateTime.UtcNow;
            record.FailureCount++;

            mediaFile.IsMissing = true;
            mediaFile.MissingSinceUtc = mediaFile.MissingSinceUtc ?? DateTime.UtcNow;

            AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Missing, record.Sha256Hash, null, record.FileSizeBytes, 0, fileSw.ElapsedMilliseconds, record.CorruptionReason, "ExistenceCheck");
            return record;
        }

        // File is present on disk! Mark media file as not missing
        mediaFile.IsMissing = false;
        mediaFile.MissingSinceUtc = null;

        var fileInfo = new FileInfo(filePath);
        var currentSize = fileInfo.Length;
        var currentModifiedUtc = fileInfo.LastWriteTimeUtc;

        record.PreviousFileSizeBytes = record.FileSizeBytes > 0 ? record.FileSizeBytes : (long?)null;
        record.FileSizeBytes = currentSize;

        record.PreviousFileModifiedTimeUtc = record.FileModifiedTimeUtc;
        record.FileModifiedTimeUtc = currentModifiedUtc;

        // 3. Check for 0-byte truncated files
        if (currentSize == 0)
        {
            record.Status = IntegrityFileStatus.Corrupted;
            record.CorruptionReason = "File is empty (0 bytes), incomplete or truncated.";
            record.LastVerifiedAtUtc = DateTime.UtcNow;
            record.FailureCount++;

            AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Corrupted, record.Sha256Hash, null, record.PreviousFileSizeBytes, 0, fileSw.ElapsedMilliseconds, record.CorruptionReason, "SizeCheck");
            return record;
        }

        // 4. SHA-256 Fingerprinting
        string? currentHash = record.Sha256Hash;
        bool shouldHash = verifyHash;

        if (verifyHash && settings.VerificationStrategy == "SmartIncremental")
        {
            // If size and mtime are unchanged and we already have a recorded hash, skip expensive full hashing
            if (record.PreviousFileSizeBytes.HasValue &&
                record.PreviousFileSizeBytes.Value == currentSize &&
                record.PreviousFileModifiedTimeUtc.HasValue &&
                Math.Abs((record.PreviousFileModifiedTimeUtc.Value - currentModifiedUtc).TotalSeconds) < 2 &&
                !string.IsNullOrEmpty(record.Sha256Hash))
            {
                shouldHash = false;
                currentHash = record.Sha256Hash;
            }
        }

        if (shouldHash)
        {
            try
            {
                currentHash = await ComputeSha256StreamingAsync(filePath, settings.HashBufferSizeKb, cancellationToken);
                record.PreviousSha256Hash = record.Sha256Hash;
                record.Sha256Hash = currentHash;
                mediaFile.FileHashSha256 = currentHash;

                if (!string.IsNullOrEmpty(record.PreviousSha256Hash) &&
                    !string.Equals(record.PreviousSha256Hash, currentHash, StringComparison.OrdinalIgnoreCase))
                {
                    // Unexpected content change detected!
                    record.Status = IntegrityFileStatus.Modified;
                    record.CorruptionReason = $"File content fingerprint changed. Previous: {record.PreviousSha256Hash[..8]}..., Current: {currentHash[..8]}...";
                    record.LastVerifiedAtUtc = DateTime.UtcNow;

                    context.IntegrityEvents.Add(new IntegrityEvent
                    {
                        EventType = IntegrityEventType.FileModified,
                        Severity = "Warning",
                        Title = "File Modification Detected",
                        Description = $"Media file '{Path.GetFileName(filePath)}' content has been modified.",
                        FilePath = filePath,
                        MediaFileId = mediaFile.Id
                    });

                    AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Modified, record.PreviousSha256Hash, currentHash, record.PreviousFileSizeBytes, currentSize, fileSw.ElapsedMilliseconds, record.CorruptionReason, "HashVerification");
                    return record;
                }
            }
            catch (UnauthorizedAccessException ex)
            {
                record.Status = IntegrityFileStatus.Unreadable;
                record.CorruptionReason = $"Permission denied accessing file: {ex.Message}";
                record.LastVerifiedAtUtc = DateTime.UtcNow;
                record.FailureCount++;

                AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Unreadable, record.Sha256Hash, null, record.PreviousFileSizeBytes, currentSize, fileSw.ElapsedMilliseconds, record.CorruptionReason, "AccessCheck");
                return record;
            }
            catch (IOException ex)
            {
                record.Status = IntegrityFileStatus.Unreadable;
                record.CorruptionReason = $"I/O or sharing lock error: {ex.Message}";
                record.LastVerifiedAtUtc = DateTime.UtcNow;
                record.FailureCount++;

                AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Unreadable, record.Sha256Hash, null, record.PreviousFileSizeBytes, currentSize, fileSw.ElapsedMilliseconds, record.CorruptionReason, "IOCheck");
                return record;
            }
        }

        // 5. FFprobe Container & Stream Validation
        if (runFfprobe)
        {
            try
            {
                var probe = await _ffprobe.ProbeFileAsync(filePath, cancellationToken);
                record.FfprobeValid = probe.Success;

                if (!probe.Success)
                {
                    // Check if it's an unsupported format vs genuine corruption
                    var ext = Path.GetExtension(filePath).ToLowerInvariant();
                    var knownVideoOrAudio = new HashSet<string> { ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".mp3", ".flac", ".m4a", ".aac", ".wav", ".ogg", ".opus" };

                    if (knownVideoOrAudio.Contains(ext))
                    {
                        record.Status = IntegrityFileStatus.Corrupted;
                        record.CorruptionReason = $"FFprobe container analysis failed: {probe.ErrorMessage ?? "Invalid media header or missing moov atom"}";
                        record.FfprobeDetails = probe.ErrorMessage;
                        record.FailureCount++;

                        context.IntegrityEvents.Add(new IntegrityEvent
                        {
                            EventType = IntegrityEventType.FileCorrupted,
                            Severity = "Error",
                            Title = "Corrupted Media Container",
                            Description = $"Container corruption in '{Path.GetFileName(filePath)}': {record.CorruptionReason}",
                            FilePath = filePath,
                            MediaFileId = mediaFile.Id
                        });

                        AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Corrupted, record.PreviousSha256Hash, currentHash, record.PreviousFileSizeBytes, currentSize, fileSw.ElapsedMilliseconds, record.CorruptionReason, "FFprobeCheck");
                        return record;
                    }
                    else
                    {
                        record.Status = IntegrityFileStatus.UnsupportedFormat;
                        record.CorruptionReason = $"Codec or container not natively probeable: {probe.ErrorMessage}";
                    }
                }
                else
                {
                    // If video or audio file, verify it has at least 1 valid playable stream
                    var isAudioOrVideo = probe.Streams.Any(s => s.StreamType == MediaStreamType.Video || s.StreamType == MediaStreamType.Audio);
                    var isPhoto = Path.GetExtension(filePath).ToLowerInvariant() is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif" or ".bmp";

                    if (!isPhoto && !isAudioOrVideo && probe.Streams.Count == 0)
                    {
                        record.Status = IntegrityFileStatus.Corrupted;
                        record.CorruptionReason = "Media container contains 0 audio and 0 video streams.";
                        record.FailureCount++;

                        AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Corrupted, record.PreviousSha256Hash, currentHash, record.PreviousFileSizeBytes, currentSize, fileSw.ElapsedMilliseconds, record.CorruptionReason, "StreamCountCheck");
                        return record;
                    }

                    // Optional deep decoding test
                    if (settings.ProbeDeepDecoding && isAudioOrVideo)
                    {
                        var decodeArgs = $"-v error -i \"{filePath.Replace("\"", "\\\"")}\" -t 5 -f null -";
                        var decodeRes = await _ffmpegRunner.RunFFmpegAsync(decodeArgs, cancellationToken);
                        if (!decodeRes.Success)
                        {
                            record.Status = IntegrityFileStatus.Corrupted;
                            record.CorruptionReason = $"Stream decode check failed: {decodeRes.StandardError}";
                            record.FailureCount++;

                            AddHistoryRecord(context, scanId, mediaFile.Id, filePath, IntegrityFileStatus.Corrupted, record.PreviousSha256Hash, currentHash, record.PreviousFileSizeBytes, currentSize, fileSw.ElapsedMilliseconds, record.CorruptionReason, "DeepDecodeCheck");
                            return record;
                        }
                    }

                    record.FfprobeDetails = $"Format: {probe.ContainerFormat}, Streams: {probe.Streams.Count}, Duration: {probe.DurationSeconds:F1}s";
                }
            }
            catch (Exception ex)
            {
                record.FfprobeValid = false;
                record.CorruptionReason = $"Probing exception: {ex.Message}";
                _logger.LogWarning(ex, "Error running ffprobe on {Path}", filePath);
            }
        }

        // Passed all checks!
        record.Status = IntegrityFileStatus.Healthy;
        record.CorruptionReason = null;
        record.LastVerifiedAtUtc = DateTime.UtcNow;
        record.VerifiedCount++;

        if (existingRecord == null)
        {
            context.IntegrityFileRecords.Add(record);
        }

        AddHistoryRecord(
            context,
            scanId,
            mediaFile.Id,
            filePath,
            IntegrityFileStatus.Healthy,
            record.PreviousSha256Hash,
            currentHash,
            record.PreviousFileSizeBytes,
            currentSize,
            fileSw.ElapsedMilliseconds,
            null,
            shouldHash ? "FullHashAndProbe" : "SmartIncremental");

        return record;
    }

    private static void AddHistoryRecord(
        VistaraDbContext context,
        Guid? scanId,
        Guid? mediaFileId,
        string filePath,
        IntegrityFileStatus status,
        string? prevHash,
        string? currentHash,
        long? prevSize,
        long? currentSize,
        long durationMs,
        string? errorDetails,
        string checkType)
    {
        context.IntegrityVerificationHistories.Add(new IntegrityVerificationHistory
        {
            IntegrityScanId = scanId,
            MediaFileId = mediaFileId,
            FilePath = filePath,
            VerifiedAtUtc = DateTime.UtcNow,
            ResultStatus = status,
            PreviousHash = prevHash,
            CurrentHash = currentHash,
            PreviousSize = prevSize,
            CurrentSize = currentSize,
            DurationMs = durationMs,
            ErrorDetails = errorDetails,
            CheckType = checkType
        });
    }

    public static async Task<string> ComputeSha256StreamingAsync(string filePath, int bufferSizeKb, CancellationToken cancellationToken)
    {
        var bufferBytes = Math.Max(64, Math.Min(8192, bufferSizeKb)) * 1024;
        using var sha256 = SHA256.Create();
        using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read, bufferBytes, useAsync: true);

        var hashBytes = await sha256.ComputeHashAsync(stream, cancellationToken);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    private bool CheckIfPlaybackActive()
    {
        try
        {
            // If background task manager or active playback progress exists
            return false;
        }
        catch
        {
            return false;
        }
    }

    private static async Task SetAppSettingAsync(VistaraDbContext context, string key, string value, CancellationToken cancellationToken)
    {
        var setting = await context.AppSettings.FindAsync(new object[] { key }, cancellationToken);
        if (setting != null)
        {
            setting.Value = value;
            setting.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {
            context.AppSettings.Add(new AppSetting
            {
                Key = key,
                Value = value,
                Category = "Integrity",
                Description = $"Setting for {key}",
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
    }

    private static IntegrityScanDto MapScanToDto(IntegrityScan s)
    {
        return new IntegrityScanDto
        {
            Id = s.Id,
            LibraryId = s.LibraryId,
            LibraryName = s.Library?.Name,
            ScanType = s.ScanType,
            Status = s.Status,
            StartedAtUtc = s.StartedAtUtc,
            CompletedAtUtc = s.CompletedAtUtc,
            TotalFilesDiscovered = s.TotalFilesDiscovered,
            FilesVerified = s.FilesVerified,
            FilesHealthy = s.FilesHealthy,
            FilesModified = s.FilesModified,
            FilesMissing = s.FilesMissing,
            FilesCorrupted = s.FilesCorrupted,
            FilesUnreadable = s.FilesUnreadable,
            FilesDriveDisconnected = s.FilesDriveDisconnected,
            TotalBytesScanned = s.TotalBytesScanned,
            DurationMs = s.DurationMs,
            ErrorMessage = s.ErrorMessage,
            TriggeredBy = s.TriggeredBy
        };
    }

    private static IntegrityFileRecordDto MapFileRecordToDto(IntegrityFileRecord r, string? title = null, string? libName = null)
    {
        return new IntegrityFileRecordDto
        {
            Id = r.Id,
            MediaFileId = r.MediaFileId,
            MediaItemId = r.MediaItemId,
            Title = title ?? Path.GetFileName(r.FilePath),
            LibraryId = r.LibraryId,
            LibraryName = libName ?? r.Library?.Name ?? "Main Collection",
            FilePath = r.FilePath,
            DriveRoot = r.DriveRoot,
            IsDriveAccessible = r.IsDriveAccessible,
            FileSizeBytes = r.FileSizeBytes,
            PreviousFileSizeBytes = r.PreviousFileSizeBytes,
            FileModifiedTimeUtc = r.FileModifiedTimeUtc,
            PreviousFileModifiedTimeUtc = r.PreviousFileModifiedTimeUtc,
            Sha256Hash = r.Sha256Hash,
            PreviousSha256Hash = r.PreviousSha256Hash,
            Status = r.Status,
            CorruptionReason = r.CorruptionReason,
            FfprobeValid = r.FfprobeValid,
            FfprobeDetails = r.FfprobeDetails,
            LastVerifiedAtUtc = r.LastVerifiedAtUtc,
            VerifiedCount = r.VerifiedCount,
            FailureCount = r.FailureCount
        };
    }
}

