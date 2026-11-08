namespace Vistara.Core.Enums;

public enum MediaType
{
    Movie = 1,
    Episode = 2,
    Track = 3,
    Photo = 4,
    Video = 5,
    Custom = 6
}

public enum MediaStreamType
{
    Video = 1,
    Audio = 2,
    Subtitle = 3,
    Attachment = 4
}

public enum LibraryType
{
    Movies = 1,
    TVShows = 2,
    Music = 3,
    Photos = 4,
    Custom = 5,
    [Obsolete("Anime catalog removed")]
    Anime = 6
}

public enum JobStatus
{
    Pending = 0,
    Running = 1,
    Paused = 2,
    Completed = 3,
    Failed = 4,
    Cancelled = 5
}

public enum JobType
{
    LibraryScan = 1,
    MetadataRefresh = 2,
    ThumbnailGeneration = 3,
    Transcode = 4,
    Backup = 5,
    DatabaseMaintenance = 6,
    DuplicateDetection = 7
}

public enum ScanMode
{
    Manual = 1,
    Automatic = 2,
    Scheduled = 3,
    Incremental = 4,
    FullReconciliation = 5
}

public enum ArtworkType
{
    Poster = 1,
    Backdrop = 2,
    Banner = 3,
    Thumb = 4,
    Still = 5,
    Artist = 6,
    Logo = 7,
    Cover = 8
}

public enum BackupType
{
    Manual = 1,
    Daily = 2,
    Weekly = 3,
    Monthly = 4,
    PreUpdate = 5,
    Recovery = 6
}

public enum PlaybackPipelineMode
{
    DirectPlay = 1,
    DirectStream = 2, // Remuxing container without re-encoding
    Transcode = 3     // Full video/audio transcoding (HLS/WebM)
}

public enum IntegrityScanType
{
    Full = 1,
    Incremental = 2,
    Quick = 3,
    SingleFile = 4,
    SelectedFolder = 5
}

public enum IntegrityScanStatus
{
    Pending = 0,
    Running = 1,
    Paused = 2,
    Completed = 3,
    Cancelled = 4,
    Failed = 5
}

public enum IntegrityFileStatus
{
    Healthy = 1,
    Modified = 2,
    Missing = 3,
    Corrupted = 4,
    Unreadable = 5,
    DriveDisconnected = 6,
    UnsupportedFormat = 7,
    PendingVerification = 8
}

public enum IntegrityEventType
{
    ScanStarted = 1,
    ScanCompleted = 2,
    FileModified = 3,
    FileCorrupted = 4,
    FileMissing = 5,
    DriveDisconnected = 6,
    FileRelinked = 7,
    ScanFailed = 8
}

public enum VerificationStrategy
{
    SmartIncremental = 1,
    FullHash = 2,
    ContainerProbeOnly = 3
}


