using Vistara.Core.Enums;

namespace Vistara.Core.Models;

public class IntegrityScan : BaseEntity
{
    public Guid? LibraryId { get; set; }
    public Library? Library { get; set; }
    public IntegrityScanType ScanType { get; set; } = IntegrityScanType.Incremental;
    public IntegrityScanStatus Status { get; set; } = IntegrityScanStatus.Pending;
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
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
    public bool VerifyHash { get; set; } = true;
    public bool RunFfprobe { get; set; } = true;
}

public class IntegrityFileRecord : BaseEntity
{
    public Guid? MediaFileId { get; set; }
    public MediaFile? MediaFile { get; set; }
    public Guid? MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public Guid LibraryId { get; set; }
    public Library? Library { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string DriveRoot { get; set; } = string.Empty;
    public bool IsDriveAccessible { get; set; } = true;
    public long FileSizeBytes { get; set; }
    public long? PreviousFileSizeBytes { get; set; }
    public DateTime? FileModifiedTimeUtc { get; set; }
    public DateTime? PreviousFileModifiedTimeUtc { get; set; }
    public string? Sha256Hash { get; set; }
    public string? PreviousSha256Hash { get; set; }
    public IntegrityFileStatus Status { get; set; } = IntegrityFileStatus.PendingVerification;
    public string? CorruptionReason { get; set; }
    public bool? FfprobeValid { get; set; }
    public string? FfprobeDetails { get; set; }
    public DateTime? LastVerifiedAtUtc { get; set; }
    public int VerifiedCount { get; set; }
    public int FailureCount { get; set; }
}

public class IntegrityVerificationHistory : BaseEntity
{
    public Guid? IntegrityScanId { get; set; }
    public IntegrityScan? IntegrityScan { get; set; }
    public Guid? MediaFileId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public DateTime VerifiedAtUtc { get; set; } = DateTime.UtcNow;
    public IntegrityFileStatus ResultStatus { get; set; }
    public string? PreviousHash { get; set; }
    public string? CurrentHash { get; set; }
    public long? PreviousSize { get; set; }
    public long? CurrentSize { get; set; }
    public long DurationMs { get; set; }
    public string? ErrorDetails { get; set; }
    public string CheckType { get; set; } = "SmartIncremental";
}

public class IntegrityEvent : BaseEntity
{
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    public IntegrityEventType EventType { get; set; }
    public string Severity { get; set; } = "Info"; // Info, Warning, Error, Critical
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? FilePath { get; set; }
    public Guid? MediaFileId { get; set; }
    public bool Resolved { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
}

