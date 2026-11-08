namespace Vistara.Core.Models;

public class Artist : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Biography { get; set; }
    public string? Country { get; set; }
    public string? Genres { get; set; }
    public Guid? ArtworkId { get; set; }
    public Artwork? Artwork { get; set; }

    public List<Album> Albums { get; set; } = new();
    public List<Track> Tracks { get; set; } = new();
}

public class Album : BaseEntity
{
    public Guid ArtistId { get; set; }
    public Artist? Artist { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? ReleaseYear { get; set; }
    public string? Genre { get; set; }
    public int? TotalTracks { get; set; }
    public int? DiscCount { get; set; }
    public Guid? ArtworkId { get; set; }
    public Artwork? Artwork { get; set; }

    public List<Track> Tracks { get; set; } = new();
}

public class Track : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public Guid? AlbumId { get; set; }
    public Album? Album { get; set; }
    public Guid? ArtistId { get; set; }
    public Artist? Artist { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? TrackNumber { get; set; }
    public int? DiscNumber { get; set; }
    public double DurationSeconds { get; set; }
    public int? Year { get; set; }
    public string? Genre { get; set; }
    public string? Lyrics { get; set; }
    public double? ReplayGainTrackGain { get; set; }
    public double? ReplayGainAlbumGain { get; set; }
}

public class Playlist : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? CoverArtworkId { get; set; }
    public Artwork? CoverArtwork { get; set; }

    public List<PlaylistTrack> Items { get; set; } = new();
}

public class PlaylistTrack : BaseEntity
{
    public Guid PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public int Position { get; set; }
    public DateTime AddedAtUtc { get; set; } = DateTime.UtcNow;
}

