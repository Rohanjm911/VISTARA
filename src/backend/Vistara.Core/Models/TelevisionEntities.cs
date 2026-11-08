namespace Vistara.Core.Models;

public class TVShow : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public string? ImdbId { get; set; }
    public string? TmdbId { get; set; }
    public string? Network { get; set; }
    public string? Status { get; set; } // "Ended", "Continuing"
    public string? Cast { get; set; }

    public List<Season> Seasons { get; set; } = new();
}

public class Season : BaseEntity
{
    public Guid TVShowId { get; set; }
    public TVShow? TVShow { get; set; }
    public int SeasonNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Overview { get; set; }
    public Guid? PosterArtworkId { get; set; }
    public Artwork? PosterArtwork { get; set; }

    public List<Episode> Episodes { get; set; } = new();
}

public class Episode : BaseEntity
{
    public Guid SeasonId { get; set; }
    public Season? Season { get; set; }
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public int EpisodeNumber { get; set; }
    public int? AbsoluteEpisodeNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Overview { get; set; }
    public DateTime? AirDate { get; set; }
    public double? IntroStartSeconds { get; set; }
    public double? IntroEndSeconds { get; set; }
    public double? CreditsStartSeconds { get; set; }
    public Guid? StillArtworkId { get; set; }
    public Artwork? StillArtwork { get; set; }
}

