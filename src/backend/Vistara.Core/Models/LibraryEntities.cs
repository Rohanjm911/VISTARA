using Vistara.Core.Enums;

namespace Vistara.Core.Models;

public class Library : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public LibraryType Type { get; set; } = LibraryType.Movies;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public bool AutoScanEnabled { get; set; } = true;
    public int ScanIntervalMinutes { get; set; } = 60;

    public List<LibraryFolder> Folders { get; set; } = new();
    public List<MediaItem> MediaItems { get; set; } = new();
}

public class LibraryFolder : BaseEntity
{
    public Guid LibraryId { get; set; }
    public Library? Library { get; set; }
    public string Path { get; set; } = string.Empty;
    public bool IsMonitored { get; set; } = true;
    public DateTime? LastScannedUtc { get; set; }
    public bool IsAccessible { get; set; } = true;

    public List<ScanHistory> ScanHistoryItems { get; set; } = new();
}

public class ScanHistory : BaseEntity
{
    public Guid LibraryId { get; set; }
    public Guid? LibraryFolderId { get; set; }
    public ScanMode ScanMode { get; set; } = ScanMode.Manual;
    public DateTime StartTimeUtc { get; set; } = DateTime.UtcNow;
    public DateTime? EndTimeUtc { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Pending;
    public int FilesDiscovered { get; set; }
    public int FilesProcessed { get; set; }
    public int FilesUpdated { get; set; }
    public int FilesMissing { get; set; }
    public string? ErrorMessage { get; set; }
}

