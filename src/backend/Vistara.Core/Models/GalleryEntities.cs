namespace Vistara.Core.Models;

public class Photo : BaseEntity
{
    public Guid MediaItemId { get; set; }
    public MediaItem? MediaItem { get; set; }
    public DateTime? DateTakenUtc { get; set; }
    public string? CameraMake { get; set; }
    public string? CameraModel { get; set; }
    public string? LensModel { get; set; }
    public double? FocalLengthMm { get; set; }
    public double? ApertureFNumber { get; set; }
    public string? ShutterSpeed { get; set; }
    public int? IsoSpeed { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Orientation { get; set; } = 1;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public string? LocationName { get; set; }

    public List<PhotoAlbumItem> AlbumItems { get; set; } = new();
}

public class PhotoAlbum : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? CoverPhotoId { get; set; }
    public Photo? CoverPhoto { get; set; }

    public List<PhotoAlbumItem> Items { get; set; } = new();
}

public class PhotoAlbumItem : BaseEntity
{
    public Guid PhotoAlbumId { get; set; }
    public PhotoAlbum? PhotoAlbum { get; set; }
    public Guid PhotoId { get; set; }
    public Photo? Photo { get; set; }
    public int Order { get; set; }
}

