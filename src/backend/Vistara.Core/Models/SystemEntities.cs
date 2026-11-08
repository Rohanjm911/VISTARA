using Vistara.Core.Enums;

namespace Vistara.Core.Models;

public class BackgroundJob : BaseEntity
{
    public JobType Type { get; set; } = JobType.LibraryScan;
    public JobStatus Status { get; set; } = JobStatus.Pending;
    public double ProgressPercentage { get; set; }
    public string? ProgressMessage { get; set; }
    public string? DetailsJson { get; set; }
    public bool CanCancel { get; set; } = true;
    public bool CanPause { get; set; } = false;
    public DateTime StartTimeUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedTimeUtc { get; set; }
    public string? ErrorMessage { get; set; }
}

public class ScheduledTask : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public JobType TaskType { get; set; }
    public string? CronExpression { get; set; }
    public int IntervalMinutes { get; set; } = 60;
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastRunUtc { get; set; }
    public DateTime? NextRunUtc { get; set; }
    public JobStatus LastStatus { get; set; } = JobStatus.Pending;
}

public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Category { get; set; } = "General";
    public string? Description { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class UserPreference
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class AppLog : BaseEntity
{
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    public string Level { get; set; } = "Information";
    public string Message { get; set; } = string.Empty;
    public string? Exception { get; set; }
    public string? SourceContext { get; set; }
    public string? PropertiesJson { get; set; }
}

public class BackupHistory : BaseEntity
{
    public string BackupName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public BackupType BackupType { get; set; } = BackupType.Manual;
    public string Status { get; set; } = "Completed";
    public bool VerifiedSuccessfully { get; set; } = true;
    public string? Notes { get; set; }
}

public class MetadataCache : BaseEntity
{
    public string ProviderName { get; set; } = string.Empty;
    public string ProviderKey { get; set; } = string.Empty;
    public string ContentJson { get; set; } = string.Empty;
    public DateTime? ExpiresAtUtc { get; set; }
}

