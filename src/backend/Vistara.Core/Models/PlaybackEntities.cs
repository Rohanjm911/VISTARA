namespace Vistara.Core.Models;

public class PlaybackProgress : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public Guid MediaFileId { get; set; }
    public MediaFile? MediaFile { get; set; }
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public double PercentageWatched { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime LastPlayedUtc { get; set; } = DateTime.UtcNow;
    public int? SelectedAudioStreamIndex { get; set; }
    public int? SelectedSubtitleStreamIndex { get; set; }
}

public class PlaybackSession : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public Guid MediaFileId { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = "Local Device";
    public DateTime StartTimeUtc { get; set; } = DateTime.UtcNow;
    public DateTime LastHeartbeatUtc { get; set; } = DateTime.UtcNow;
    public double CurrentPositionSeconds { get; set; }
    public bool IsTranscoding { get; set; }
    public string? TranscodeReason { get; set; }
    public string? HardwareAccelerationMethod { get; set; }
}

