using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class GalleryController : ControllerBase
{
    private readonly VistaraDbContext _context;

    public GalleryController(VistaraDbContext context)
    {
        _context = context;
    }

    [HttpGet("photos")]
    public async Task<IActionResult> GetPhotos([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var query = _context.Photos
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.Files)
            .OrderByDescending(p => p.DateTakenUtc ?? p.CreatedAtUtc);

        var total = await query.CountAsync();
        var photos = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = photos.Select(p =>
        {
            var firstFile = p.MediaItem?.Files.FirstOrDefault();
            return new PhotoDto
            {
                Id = p.MediaItemId,
                PhotoId = p.Id,
                Title = p.MediaItem?.Title ?? "Untitled Photo",
                DateTakenUtc = p.DateTakenUtc,
                CameraMake = p.CameraMake,
                CameraModel = p.CameraModel,
                LensModel = p.LensModel,
                FocalLengthMm = p.FocalLengthMm,
                ApertureFNumber = p.ApertureFNumber,
                ShutterSpeed = p.ShutterSpeed,
                IsoSpeed = p.IsoSpeed,
                Width = p.Width,
                Height = p.Height,
                Orientation = p.Orientation,
                LocationName = p.LocationName,
                IsFavourite = p.MediaItem?.IsFavourite ?? false,
                ThumbnailUrl = p.MediaItem?.PrimaryArtwork != null
                    ? $"/api/v1/artwork/{p.MediaItem.PrimaryArtwork.Id}"
                    : (firstFile != null ? $"/api/v1/stream/{firstFile.Id}" : null),
                FullImageUrl = firstFile != null ? $"/api/v1/stream/{firstFile.Id}" : null,
                MediaFileId = firstFile?.Id ?? Guid.Empty,
                FileSizeBytes = firstFile?.FileSizeBytes ?? 0
            };
        }).ToList();

        return Ok(ApiResponse<PagedResult<PhotoDto>>.Ok(new PagedResult<PhotoDto>(dtos, total, page, pageSize)));
    }

    [HttpGet("timeline")]
    public async Task<IActionResult> GetTimeline()
    {
        var photos = await _context.Photos
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.Files)
            .OrderByDescending(p => p.DateTakenUtc ?? p.CreatedAtUtc)
            .Take(200)
            .ToListAsync();

        var groups = photos
            .GroupBy(p => (p.DateTakenUtc ?? p.CreatedAtUtc).ToString("MMMM yyyy"))
            .Select(g => new
            {
                MonthYear = g.Key,
                Count = g.Count(),
                Photos = g.Select(p =>
                {
                    var firstFile = p.MediaItem?.Files.FirstOrDefault();
                    return new PhotoDto
                    {
                        Id = p.MediaItemId,
                        PhotoId = p.Id,
                        Title = p.MediaItem?.Title ?? "Untitled",
                        DateTakenUtc = p.DateTakenUtc,
                        CameraMake = p.CameraMake,
                        CameraModel = p.CameraModel,
                        Width = p.Width,
                        Height = p.Height,
                        ThumbnailUrl = p.MediaItem?.PrimaryArtwork != null
                            ? $"/api/v1/artwork/{p.MediaItem.PrimaryArtwork.Id}"
                            : (firstFile != null ? $"/api/v1/stream/{firstFile.Id}" : null),
                        FullImageUrl = firstFile != null ? $"/api/v1/stream/{firstFile.Id}" : null,
                        MediaFileId = firstFile?.Id ?? Guid.Empty
                    };
                }).ToList()
            }).ToList();

        return Ok(ApiResponse<object>.Ok(groups));
    }

    [HttpGet("albums")]
    public async Task<IActionResult> GetAlbums()
    {
        var albums = await _context.PhotoAlbums
            .Include(pa => pa.CoverPhoto)
                .ThenInclude(cp => cp!.MediaItem)
                    .ThenInclude(mi => mi!.Files)
            .Include(pa => pa.Items)
            .OrderBy(pa => pa.Name)
            .ToListAsync();

        var dtos = albums.Select(pa => new PhotoAlbumDto
        {
            Id = pa.Id,
            Name = pa.Name,
            Description = pa.Description,
            CoverUrl = pa.CoverPhoto?.MediaItem?.Files.FirstOrDefault() != null ? $"/api/v1/stream/{pa.CoverPhoto.MediaItem.Files.First().Id}" : null,
            PhotoCount = pa.Items.Count
        }).ToList();

        return Ok(ApiResponse<List<PhotoAlbumDto>>.Ok(dtos));
    }

    [HttpPost("photos/{id}/favourite")]
    public async Task<IActionResult> ToggleFavourite(Guid id)
    {
        var item = await _context.MediaItems.FirstOrDefaultAsync(m => m.Id == id);
        if (item == null) return NotFound(ApiResponse<bool>.Fail("Photo not found"));

        item.IsFavourite = !item.IsFavourite;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(item.IsFavourite, item.IsFavourite ? "Added to favourites" : "Removed from favourites"));
    }
}

