using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PlaylistsController : ControllerBase
{
    private readonly VistaraDbContext _context;

    public PlaylistsController(VistaraDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetPlaylists()
    {
        var playlists = await _context.Playlists
            .Include(p => p.CoverArtwork)
            .Include(p => p.Items)
                .ThenInclude(pi => pi.MediaItem)
                    .ThenInclude(m => m!.Files)
            .OrderBy(p => p.Name)
            .ToListAsync();

        var dtos = playlists.Select(p => new PlaylistDto
        {
            Id = p.Id,
            Name = p.Name,
            Description = p.Description,
            CoverUrl = p.CoverArtwork != null ? $"/api/v1/artwork/{p.CoverArtwork.Id}" : null,
            ItemCount = p.Items.Count,
            TotalDurationSeconds = p.Items.Sum(pi => pi.MediaItem?.Files.FirstOrDefault()?.DurationSeconds ?? 0)
        }).ToList();

        return Ok(ApiResponse<List<PlaylistDto>>.Ok(dtos));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPlaylist(Guid id)
    {
        var playlist = await _context.Playlists
            .Include(p => p.CoverArtwork)
            .Include(p => p.Items.OrderBy(pi => pi.Position))
                .ThenInclude(pi => pi.MediaItem)
                    .ThenInclude(m => m!.PrimaryArtwork)
            .Include(p => p.Items)
                .ThenInclude(pi => pi.MediaItem)
                    .ThenInclude(m => m!.Files)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (playlist == null) return NotFound(ApiResponse<PlaylistDto>.Fail("Playlist not found"));

        var dto = new PlaylistDto
        {
            Id = playlist.Id,
            Name = playlist.Name,
            Description = playlist.Description,
            CoverUrl = playlist.CoverArtwork != null ? $"/api/v1/artwork/{playlist.CoverArtwork.Id}" : null,
            ItemCount = playlist.Items.Count,
            TotalDurationSeconds = playlist.Items.Sum(pi => pi.MediaItem?.Files.FirstOrDefault()?.DurationSeconds ?? 0),
            Items = playlist.Items.Select(pi => new PlaylistItemDto
            {
                Id = pi.Id,
                MediaItemId = pi.MediaItemId,
                Type = pi.MediaItem?.Type ?? Core.Enums.MediaType.Track,
                Title = pi.MediaItem?.Title ?? "Unknown Item",
                DurationSeconds = pi.MediaItem?.Files.FirstOrDefault()?.DurationSeconds ?? 0,
                ArtworkUrl = pi.MediaItem?.PrimaryArtwork != null ? $"/api/v1/artwork/{pi.MediaItem.PrimaryArtwork.Id}" : null,
                Position = pi.Position,
                MediaFileId = pi.MediaItem?.Files.FirstOrDefault()?.Id ?? Guid.Empty
            }).ToList()
        };

        return Ok(ApiResponse<PlaylistDto>.Ok(dto));
    }

    [HttpPost]
    public async Task<IActionResult> CreatePlaylist([FromBody] CreatePlaylistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(ApiResponse<bool>.Fail("Playlist name cannot be empty"));

        var playlist = new Playlist
        {
            Name = request.Name,
            Description = request.Description
        };

        if (request.MediaItemIds != null)
        {
            int pos = 0;
            foreach (var itemId in request.MediaItemIds)
            {
                playlist.Items.Add(new PlaylistTrack
                {
                    MediaItemId = itemId,
                    Position = pos++
                });
            }
        }

        _context.Playlists.Add(playlist);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { playlist.Id, playlist.Name }, "Playlist created"));
    }

    [HttpPost("{id:guid}/tracks")]
    public async Task<IActionResult> AddTrack(Guid id, [FromBody] AddTrackToPlaylistRequest request)
    {
        var playlist = await _context.Playlists.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == id);
        if (playlist == null) return NotFound(ApiResponse<bool>.Fail("Playlist not found"));

        int maxPos = playlist.Items.Count > 0 ? playlist.Items.Max(pi => pi.Position) + 1 : 0;
        var item = new PlaylistTrack
        {
            PlaylistId = id,
            MediaItemId = request.MediaItemId,
            Position = maxPos
        };

        _context.PlaylistTracks.Add(item);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Item added to playlist"));
    }

    [HttpDelete("{id:guid}/tracks/{trackId:guid}")]
    public async Task<IActionResult> RemoveTrack(Guid id, Guid trackId)
    {
        var item = await _context.PlaylistTracks.FirstOrDefaultAsync(pi => pi.PlaylistId == id && pi.Id == trackId);
        if (item == null) return NotFound(ApiResponse<bool>.Fail("Item not found"));

        _context.PlaylistTracks.Remove(item);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Item removed from playlist"));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePlaylist(Guid id)
    {
        var playlist = await _context.Playlists.Include(p => p.Items).FirstOrDefaultAsync(p => p.Id == id);
        if (playlist == null) return NotFound(ApiResponse<bool>.Fail("Playlist not found"));

        _context.Playlists.Remove(playlist);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Playlist deleted"));
    }

    [HttpGet("smart-mixes")]
    public async Task<IActionResult> GetSmartMixes()
    {
        var allTracks = await GetBaseTrackQuery().ToListAsync();
        if (allTracks.Count == 0)
        {
            return Ok(ApiResponse<List<SmartMixDto>>.Ok(new List<SmartMixDto>()));
        }

        var mixes = new List<SmartMixDto>();

        // 1. Recently Added
        var recent = allTracks.OrderByDescending(t => t.CreatedAtUtc).Take(50).ToList();
        mixes.Add(new SmartMixDto
        {
            Id = "recently-added",
            Name = "Recently Added",
            Tagline = "Fresh Arrivals",
            Description = "The newest sonic additions to your music collection",
            Gradient = "from-indigo-600 via-purple-600 to-pink-500",
            Icon = "Sparkles",
            TrackCount = recent.Count,
            TotalDurationSeconds = recent.Sum(t => t.DurationSeconds),
            SampleTracks = recent.Take(4).Select(MapTrackDto).ToList()
        });

        // 2. Heavy Rotation / Favourites
        var favourites = allTracks.Where(t => t.MediaItem?.IsFavourite == true).ToList();
        var heavyRotation = favourites.Count >= 10
            ? favourites.Take(50).ToList()
            : allTracks.OrderByDescending(t => t.DurationSeconds).Take(50).ToList();
        mixes.Add(new SmartMixDto
        {
            Id = "heavy-rotation",
            Name = "Heavy Rotation",
            Tagline = "On Constant Repeat",
            Description = "Your most loved anthems and cherished tracks",
            Gradient = "from-rose-500 via-pink-600 to-purple-700",
            Icon = "Flame",
            TrackCount = heavyRotation.Count,
            TotalDurationSeconds = heavyRotation.Sum(t => t.DurationSeconds),
            SampleTracks = heavyRotation.Take(4).Select(MapTrackDto).ToList()
        });

        // 3. Hi-Res Audio Vault
        var hiRes = allTracks.Where(t =>
            t.MediaItem?.Files.Any(f => f.AudioCodec != null && (f.AudioCodec.Contains("flac") || f.AudioCodec.Contains("alac") || f.AudioCodec.Contains("wav") || f.ContainerFormat == "flac")) == true
            || (t.MediaItem?.Files.Any(f => f.AbsolutePath.EndsWith(".flac", StringComparison.OrdinalIgnoreCase)) == true)
        ).Take(50).ToList();

        if (hiRes.Count == 0) hiRes = allTracks.Take(50).ToList();

        mixes.Add(new SmartMixDto
        {
            Id = "hi-res-vault",
            Name = "Hi-Res Audio Vault",
            Tagline = "Studio Master Acoustics",
            Description = "Lossless, uncompressed studio recordings with pure acoustic fidelity",
            Gradient = "from-emerald-600 via-teal-600 to-cyan-600",
            Icon = "Disc",
            TrackCount = hiRes.Count,
            TotalDurationSeconds = hiRes.Sum(t => t.DurationSeconds),
            SampleTracks = hiRes.Take(4).Select(MapTrackDto).ToList()
        });

        // 4. Forgotten Gems
        var forgotten = allTracks.OrderBy(t => t.CreatedAtUtc).Take(50).ToList();
        mixes.Add(new SmartMixDto
        {
            Id = "forgotten-gems",
            Name = "Forgotten Gems",
            Tagline = "Time to Rediscover",
            Description = "Exceptional tracks in your universe waiting to be heard again",
            Gradient = "from-amber-500 via-orange-600 to-red-600",
            Icon = "Compass",
            TrackCount = forgotten.Count,
            TotalDurationSeconds = forgotten.Sum(t => t.DurationSeconds),
            SampleTracks = forgotten.Take(4).Select(MapTrackDto).ToList()
        });

        // 5. Quick 30 Shuffle
        var rng = new Random();
        var quick30 = allTracks.OrderBy(_ => rng.Next()).Take(30).ToList();
        mixes.Add(new SmartMixDto
        {
            Id = "quick-30",
            Name = "Quick 30 Shuffle",
            Tagline = "Instant Party Mix",
            Description = "30 handpicked random tracks for a spontaneous listening session",
            Gradient = "from-cyan-500 via-blue-600 to-violet-700",
            Icon = "Shuffle",
            TrackCount = quick30.Count,
            TotalDurationSeconds = quick30.Sum(t => t.DurationSeconds),
            SampleTracks = quick30.Take(4).Select(MapTrackDto).ToList()
        });

        return Ok(ApiResponse<List<SmartMixDto>>.Ok(mixes));
    }

    [HttpGet("smart-mixes/{mixId}/tracks")]
    public async Task<IActionResult> GetSmartMixTracks(string mixId)
    {
        var allTracks = await GetBaseTrackQuery().ToListAsync();
        List<Track> result;

        switch (mixId.ToLower())
        {
            case "recently-added":
                result = allTracks.OrderByDescending(t => t.CreatedAtUtc).Take(50).ToList();
                break;
            case "heavy-rotation":
                var favs = allTracks.Where(t => t.MediaItem?.IsFavourite == true).ToList();
                result = favs.Count >= 10 ? favs.Take(50).ToList() : allTracks.OrderByDescending(t => t.DurationSeconds).Take(50).ToList();
                break;
            case "hi-res-vault":
                result = allTracks.Where(t =>
                    t.MediaItem?.Files.Any(f => f.AudioCodec != null && (f.AudioCodec.Contains("flac") || f.AudioCodec.Contains("alac") || f.AudioCodec.Contains("wav") || f.ContainerFormat == "flac")) == true
                    || (t.MediaItem?.Files.Any(f => f.AbsolutePath.EndsWith(".flac", StringComparison.OrdinalIgnoreCase)) == true)
                ).Take(50).ToList();
                if (result.Count == 0) result = allTracks.Take(50).ToList();
                break;
            case "forgotten-gems":
                result = allTracks.OrderBy(t => t.CreatedAtUtc).Take(50).ToList();
                break;
            case "quick-30":
            default:
                var rng = new Random();
                result = allTracks.OrderBy(_ => rng.Next()).Take(30).ToList();
                break;
        }

        var dtos = result.Select(MapTrackDto).ToList();
        return Ok(ApiResponse<List<TrackDto>>.Ok(dtos));
    }

    private IQueryable<Track> GetBaseTrackQuery()
    {
        return _context.Tracks
            .Include(t => t.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(t => t.MediaItem)
                .ThenInclude(m => m!.Files)
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .AsNoTracking();
    }

    private static TrackDto MapTrackDto(Track t)
    {
        return new TrackDto
        {
            Id = t.MediaItemId,
            TrackId = t.Id,
            AlbumId = t.AlbumId,
            AlbumTitle = t.Album?.Title,
            ArtistId = t.ArtistId,
            ArtistName = t.Artist?.Name,
            Title = t.Title,
            TrackNumber = t.TrackNumber,
            DiscNumber = t.DiscNumber,
            DurationSeconds = t.DurationSeconds,
            Year = t.Year,
            Genre = t.Genre,
            Lyrics = t.Lyrics,
            ReplayGainTrackGain = t.ReplayGainTrackGain,
            IsFavourite = t.MediaItem?.IsFavourite ?? false,
            ArtworkUrl = t.MediaItem?.PrimaryArtwork != null ? $"/api/v1/artwork/{t.MediaItem.PrimaryArtwork.Id}" : null,
            MediaFileId = t.MediaItem?.Files.FirstOrDefault()?.Id ?? Guid.Empty
        };
    }
}

public class SmartMixDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Tagline { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Gradient { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public int TrackCount { get; set; }
    public double TotalDurationSeconds { get; set; }
    public List<TrackDto> SampleTracks { get; set; } = new();
}

public class CreatePlaylistRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<Guid>? MediaItemIds { get; set; }
}

public class AddTrackToPlaylistRequest
{
    public Guid MediaItemId { get; set; }
}

