namespace Vistara.Core.Models;

public class Genre : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public List<MediaGenre> MediaGenres { get; set; } = new();
}

public class MediaGenre
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public Guid GenreId { get; set; }
    public Genre? Genre { get; set; }
}

public class Tag : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public List<MediaTag> MediaTags { get; set; } = new();
}

public class MediaTag
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public Guid TagId { get; set; }
    public Tag? Tag { get; set; }
}

