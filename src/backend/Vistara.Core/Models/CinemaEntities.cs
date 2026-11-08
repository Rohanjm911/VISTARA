namespace Vistara.Core.Models;

public class Movie : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public string? ImdbId { get; set; }
    public string? TmdbId { get; set; }
    public string? Director { get; set; }
    public string? Writers { get; set; }
    public string? Cast { get; set; }
    public string? Studio { get; set; }
    public Guid? CollectionId { get; set; }
    public MovieCollection? Collection { get; set; }

    public List<MovieEdition> Editions { get; set; } = new();
}

public class MovieEdition : BaseEntity
{
    public Guid MovieId { get; set; }
    public Movie? Movie { get; set; }
    public Guid MediaFileId { get; set; }
    public MediaFile? MediaFile { get; set; }
    public string EditionName { get; set; } = "Theatrical"; // e.g. "Theatrical", "Director's Cut", "Extended Edition", "4K HDR"
    public string? ResolutionLabel { get; set; } // "1080p", "4K UHD", "720p"
}

public class MovieCollection : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Overview { get; set; }
    public Guid? PosterArtworkId { get; set; }
    public Artwork? PosterArtwork { get; set; }

    public List<Movie> Movies { get; set; } = new();
}

