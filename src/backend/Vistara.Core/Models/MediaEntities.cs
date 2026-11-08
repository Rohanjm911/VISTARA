using Vistara.Core.Enums;

namespace Vistara.Core.Models;

public class MediaItem : BaseEntity
{
    public Guid LibraryId { get; set; }
    public Library? Library { get; set; }
    public MediaType Type { get; set; } = MediaType.Movie;
    public string Title { get; set; } = string.Empty;
    public string? OriginalTitle { get; set; }
    public string? SortTitle { get; set; }
    public int? Year { get; set; }
    public string? Overview { get; set; }
    public string? Tagline { get; set; }
    public DateTime? ReleaseDate { get; set; }
    public int? RuntimeMinutes { get; set; }
    public double? CommunityRating { get; set; }
    public string? ContentRating { get; set; }
    public bool IsFavourite { get; set; }
    public bool IsInWatchlist { get; set; }

    public Guid? PrimaryArtworkId { get; set; }
    public Artwork? PrimaryArtwork { get; set; }
    public Guid? BackdropArtworkId { get; set; }
    public Artwork? BackdropArtwork { get; set; }

    public List<MediaFile> Files { get; set; } = new();
    public List<MediaGenre> Genres { get; set; } = new();
    public List<MediaTag> Tags { get; set; } = new();
    public List<PlaybackProgress> PlaybackProgressHistory { get; set; } = new();
}

public class MediaFile : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public Guid? LibraryFolderId { get; set; }
    public LibraryFolder? LibraryFolder { get; set; }
    public string RelativePath { get; set; } = string.Empty;
    public string AbsolutePath { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string? FileHashSha256 { get; set; }
    public string? ContainerFormat { get; set; }
    public double DurationSeconds { get; set; }
    public int? BitrateKbps { get; set; }
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public int? ResolutionWidth { get; set; }
    public int? ResolutionHeight { get; set; }
    public double? FrameRate { get; set; }
    public string? EditionName { get; set; }
    public bool IsDirectPlaySupported { get; set; } = true;
    public bool IsMissing { get; set; }
    public DateTime? MissingSinceUtc { get; set; }

    public List<MediaStream> Streams { get; set; } = new();
}

public class MediaStream : BaseEntity
{
    public Guid MediaFileId { get; set; }
    public MediaFile? MediaFile { get; set; }
    public int StreamIndex { get; set; }
    public MediaStreamType StreamType { get; set; }
    public string Codec { get; set; } = string.Empty;
    public string? Profile { get; set; }
    public string? Language { get; set; }
    public string? Title { get; set; }
    public bool IsDefault { get; set; }
    public bool IsForced { get; set; }
    public int? Channels { get; set; }
    public int? SampleRate { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public string? AspectRatio { get; set; }
    public int? BitrateKbps { get; set; }
}

public class Artwork : BaseEntity
{
    public Guid? MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public ArtworkType ArtworkType { get; set; } = ArtworkType.Poster;
    public string RelativePath { get; set; } = string.Empty;
    public string AbsolutePath { get; set; } = string.Empty;
    public string MimeType { get; set; } = "image/jpeg";
    public int? Width { get; set; }
    public int? Height { get; set; }
}

