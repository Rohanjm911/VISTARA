using Vistara.Core.Enums;

namespace Vistara.Core.DTOs;

public class IntegrityDashboardDto
{
    public int TotalFilesMonitored { get; set; }
    public int HealthyFiles { get; set; }
    public int ModifiedFiles { get; set; }
    public int MissingFiles { get; set; }
    public int CorruptedFiles { get; set; }
    public int UnreadableFiles { get; set; }
    public int DriveDisconnectedFiles { get; set; }
    public int PendingVerificationFiles { get; set; }
    public double CoveragePercentage { get; set; }
    public long TotalVerifiedSizeBytes { get; set; }
    public DateTime? LastScanTimestampUtc { get; set; }
    public string? LastScanStatus { get; set; }
    public bool IsScanRunning { get; set; }
    public IntegrityScanDto? CurrentScan { get; set; }
    public List<IntegrityEventDto> RecentEvents { get; set; } = new();
}

public class IntegrityScanDto
{
    public Guid Id { get; set; }
    public Guid? LibraryId { get; set; }
    public string? LibraryName { get; set; }
    public IntegrityScanType ScanType { get; set; }
    public IntegrityScanStatus Status { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int TotalFilesDiscovered { get; set; }
    public int FilesVerified { get; set; }
    public int FilesHealthy { get; set; }
    public int FilesModified { get; set; }
    public int FilesMissing { get; set; }
    public int FilesCorrupted { get; set; }
    public int FilesUnreadable { get; set; }
    public int FilesDriveDisconnected { get; set; }
    public long TotalBytesScanned { get; set; }
    public long DurationMs { get; set; }
    public string? ErrorMessage { get; set; }
    public string TriggeredBy { get; set; } = "Manual";
    public double ProgressPercent => TotalFilesDiscovered > 0
        ? Math.Min(100.0, Math.Round((double)FilesVerified / TotalFilesDiscovered * 100, 1))
        : 0;
}

public class IntegrityScanProgressDto
{
    public Guid ScanId { get; set; }
    public IntegrityScanStatus Status { get; set; }
    public string CurrentFile { get; set; } = string.Empty;
    public int TotalFiles { get; set; }
    public int ProcessedFiles { get; set; }
    public double PercentComplete { get; set; }
    public int HealthyCount { get; set; }
    public int IssueCount { get; set; }
}

public class IntegrityFileRecordDto
{
    public Guid Id { get; set; }
    public Guid? MediaFileId { get; set; }
    public Guid? MediaItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid LibraryId { get; set; }
    public string LibraryName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string DriveRoot { get; set; } = string.Empty;
    public bool IsDriveAccessible { get; set; }
    public long FileSizeBytes { get; set; }
    public long? PreviousFileSizeBytes { get; set; }
    public DateTime? FileModifiedTimeUtc { get; set; }
    public DateTime? PreviousFileModifiedTimeUtc { get; set; }
    public string? Sha256Hash { get; set; }
    public string? PreviousSha256Hash { get; set; }
    public IntegrityFileStatus Status { get; set; }
    public string? CorruptionReason { get; set; }
    public bool? FfprobeValid { get; set; }
    public string? FfprobeDetails { get; set; }
    public DateTime? LastVerifiedAtUtc { get; set; }
    public int VerifiedCount { get; set; }
    public int FailureCount { get; set; }
}

public class IntegrityEventDto
{
    public Guid Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public IntegrityEventType EventType { get; set; }
    public string Severity { get; set; } = "Info";
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? FilePath { get; set; }
    public Guid? MediaFileId { get; set; }
    public bool Resolved { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
}

public class IntegritySettingsDto
{
    public string VerificationStrategy { get; set; } = "SmartIncremental"; // SmartIncremental, FullHash, ContainerProbeOnly
    public string ScanPriority { get; set; } = "Normal"; // Low, Normal, High
    public int MaxConcurrency { get; set; } = 2;
    public bool PauseDuringPlayback { get; set; } = true;
    public string AutoSchedule { get; set; } = "Weekly"; // Off, Daily, Weekly, Monthly
    public int ScheduledHourUtc { get; set; } = 3; // 3 AM UTC
    public int HashBufferSizeKb { get; set; } = 1024;
    public bool ProbeDeepDecoding { get; set; } = false;
    public int HistoryRetentionDays { get; set; } = 90;
}

public class StartIntegrityScanRequest
{
    public Guid? LibraryId { get; set; }
    public string ScanType { get; set; } = "Incremental"; // Full, Incremental, Quick
    public bool VerifyHash { get; set; } = true;
    public bool RunFfprobe { get; set; } = true;
}

public class RelinkMediaFileRequest
{
    public string NewPath { get; set; } = string.Empty;
}

public class RecoveryCandidateDto
{
    public string Path { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime LastModifiedUtc { get; set; }
    public bool ExactSizeMatch { get; set; }
    public int ConfidenceScore { get; set; } // 0 - 100
}

public class IntegrityVerificationHistoryDto
{
    public Guid Id { get; set; }
    public Guid? IntegrityScanId { get; set; }
    public Guid? MediaFileId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public DateTime VerifiedAtUtc { get; set; }
    public IntegrityFileStatus ResultStatus { get; set; }
    public string? PreviousHash { get; set; }
    public string? CurrentHash { get; set; }
    public long? PreviousSize { get; set; }
    public long? CurrentSize { get; set; }
    public long DurationMs { get; set; }
    public string? ErrorDetails { get; set; }
    public string CheckType { get; set; } = "SmartIncremental";
}
