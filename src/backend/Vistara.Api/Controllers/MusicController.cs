using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.Services.Music;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class MusicController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly ILyricsService _lyricsService;

    public MusicController(VistaraDbContext context, ILyricsService lyricsService)
    {
        _context = context;
        _lyricsService = lyricsService;
    }

    [HttpGet("tracks")]
    public async Task<IActionResult> GetTracks(
        [FromQuery] string? genre = null,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "title",
        [FromQuery] bool descending = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 1000)
    {
        if (pageSize <= 0) pageSize = 1000;
        else if (pageSize > 10000) pageSize = 10000;

        var query = _context.Tracks
            .Include(t => t.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(t => t.MediaItem)
                .ThenInclude(m => m!.Files)
                    .ThenInclude(f => f.Streams)
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(genre))
        {
            query = query.Where(t => t.Genre != null && t.Genre.ToLower() == genre.ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(t => 
                (t.Title != null && t.Title.ToLower().Contains(s)) ||
                (t.Artist != null && t.Artist.Name != null && t.Artist.Name.ToLower().Contains(s)) ||
                (t.Album != null && t.Album.Title != null && t.Album.Title.ToLower().Contains(s)));
        }

        query = sortBy?.ToLower() switch
        {
            "artist" => descending ? query.OrderByDescending(t => t.Artist != null ? t.Artist.Name : "").ThenBy(t => t.Title) : query.OrderBy(t => t.Artist != null ? t.Artist.Name : "").ThenBy(t => t.Title),
            "album" => descending ? query.OrderByDescending(t => t.Album != null ? t.Album.Title : "").ThenBy(t => t.TrackNumber) : query.OrderBy(t => t.Album != null ? t.Album.Title : "").ThenBy(t => t.TrackNumber),
            "duration" => descending ? query.OrderByDescending(t => t.DurationSeconds) : query.OrderBy(t => t.DurationSeconds),
            "year" => descending ? query.OrderByDescending(t => t.Year) : query.OrderBy(t => t.Year),
            _ => descending ? query.OrderByDescending(t => t.Title) : query.OrderBy(t => t.Title)
        };

        var total = await query.CountAsync();
        var tracks = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = tracks.Select(t =>
        {
            var f = t.MediaItem?.Files.FirstOrDefault();
            var s = f?.Streams.FirstOrDefault(st => st.StreamType == MediaStreamType.Audio);
            string? ext = !string.IsNullOrEmpty(f?.AbsolutePath) ? Path.GetExtension(f.AbsolutePath)?.TrimStart('.')?.ToUpperInvariant() : null;
            string format = !string.IsNullOrEmpty(f?.ContainerFormat) ? f.ContainerFormat.ToUpperInvariant() : (ext ?? "MP3");

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
                MediaFileId = f?.Id ?? Guid.Empty,
                AudioFormat = format,
                AudioCodec = s?.Codec ?? f?.AudioCodec ?? format,
                BitrateKbps = s?.BitrateKbps ?? f?.BitrateKbps,
                SampleRate = s?.SampleRate,
                Channels = s?.Channels,
                FileSizeBytes = f?.FileSizeBytes
            };
        }).ToList();

        return Ok(ApiResponse<PagedResult<TrackDto>>.Ok(new PagedResult<TrackDto>(dtos, total, page, pageSize)));
    }

    [HttpGet("artists")]
    public async Task<IActionResult> GetArtists()
    {
        var artists = await _context.Artists
            .Include(a => a.Artwork)
            .Include(a => a.Albums)
            .Include(a => a.Tracks)
            .OrderBy(a => a.Name)
            .ToListAsync();

        var dtos = artists.Select(a => new ArtistDto
        {
            Id = a.Id,
            Name = a.Name,
            Biography = a.Biography,
            Country = a.Country,
            Genres = a.Genres,
            ArtworkUrl = a.Artwork != null ? $"/api/v1/artwork/{a.Artwork.Id}" : null,
            AlbumCount = a.Albums.Count,
            TrackCount = a.Tracks.Count
        }).ToList();

        return Ok(ApiResponse<List<ArtistDto>>.Ok(dtos));
    }

    [HttpGet("artists/{id}")]
    public async Task<IActionResult> GetArtist(Guid id)
    {
        var artist = await _context.Artists
            .Include(a => a.Artwork)
            .Include(a => a.Albums)
                .ThenInclude(al => al.Tracks)
                    .ThenInclude(t => t.MediaItem)
                        .ThenInclude(m => m!.Files)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (artist == null) return NotFound(ApiResponse<ArtistDto>.Fail("Artist not found"));

        var dto = new ArtistDto
        {
            Id = artist.Id,
            Name = artist.Name,
            Biography = artist.Biography,
            Country = artist.Country,
            Genres = artist.Genres,
            ArtworkUrl = artist.Artwork != null ? $"/api/v1/artwork/{artist.Artwork.Id}" : null,
            AlbumCount = artist.Albums.Count,
            TrackCount = artist.Tracks.Count
        };

        return Ok(ApiResponse<ArtistDto>.Ok(dto));
    }

    [HttpGet("albums")]
    public async Task<IActionResult> GetAlbums()
    {
        var albums = await _context.Albums
            .Include(al => al.Artwork)
            .Include(al => al.Artist)
            .Include(al => al.Tracks)
            .OrderBy(al => al.Title)
            .ToListAsync();

        var dtos = albums.Select(al => new AlbumDto
        {
            Id = al.Id,
            ArtistId = al.ArtistId,
            ArtistName = al.Artist?.Name ?? "Unknown",
            Title = al.Title,
            ReleaseYear = al.ReleaseYear,
            Genre = al.Genre,
            TotalTracks = al.Tracks.Count,
            ArtworkUrl = al.Artwork != null ? $"/api/v1/artwork/{al.Artwork.Id}" : null
        }).ToList();

        return Ok(ApiResponse<List<AlbumDto>>.Ok(dtos));
    }

    [HttpGet("albums/{id}")]
    public async Task<IActionResult> GetAlbum(Guid id)
    {
        var album = await _context.Albums
            .Include(al => al.Artwork)
            .Include(al => al.Artist)
            .Include(al => al.Tracks.OrderBy(t => t.DiscNumber).ThenBy(t => t.TrackNumber))
                .ThenInclude(t => t.MediaItem)
                    .ThenInclude(m => m!.Files)
                        .ThenInclude(f => f.Streams)
            .FirstOrDefaultAsync(al => al.Id == id);

        if (album == null) return NotFound(ApiResponse<AlbumDto>.Fail("Album not found"));

        var dto = new AlbumDto
        {
            Id = album.Id,
            ArtistId = album.ArtistId,
            ArtistName = album.Artist?.Name ?? "Unknown",
            Title = album.Title,
            ReleaseYear = album.ReleaseYear,
            Genre = album.Genre,
            TotalTracks = album.Tracks.Count,
            ArtworkUrl = album.Artwork != null ? $"/api/v1/artwork/{album.Artwork.Id}" : null,
            Tracks = album.Tracks.Select(t =>
            {
                var f = t.MediaItem?.Files.FirstOrDefault();
                var s = f?.Streams.FirstOrDefault(st => st.StreamType == MediaStreamType.Audio);
                string? ext = !string.IsNullOrEmpty(f?.AbsolutePath) ? Path.GetExtension(f.AbsolutePath)?.TrimStart('.')?.ToUpperInvariant() : null;
                string format = !string.IsNullOrEmpty(f?.ContainerFormat) ? f.ContainerFormat.ToUpperInvariant() : (ext ?? "MP3");

                return new TrackDto
                {
                    Id = t.MediaItemId,
                    TrackId = t.Id,
                    AlbumId = t.AlbumId,
                    AlbumTitle = album.Title,
                    ArtistId = album.ArtistId,
                    ArtistName = album.Artist?.Name,
                    Title = t.Title,
                    TrackNumber = t.TrackNumber,
                    DiscNumber = t.DiscNumber,
                    DurationSeconds = t.DurationSeconds,
                    Year = t.Year,
                    Genre = t.Genre,
                    Lyrics = t.Lyrics,
                    ArtworkUrl = album.Artwork != null ? $"/api/v1/artwork/{album.Artwork.Id}" : null,
                    MediaFileId = f?.Id ?? Guid.Empty,
                    AudioFormat = format,
                    AudioCodec = s?.Codec ?? f?.AudioCodec ?? format,
                    BitrateKbps = s?.BitrateKbps ?? f?.BitrateKbps,
                    SampleRate = s?.SampleRate,
                    Channels = s?.Channels,
                    FileSizeBytes = f?.FileSizeBytes
                };
            }).ToList()
        };

        return Ok(ApiResponse<AlbumDto>.Ok(dto));
    }

    [HttpGet("genres")]
    public async Task<IActionResult> GetGenres()
    {
        var genres = await _context.Tracks
            .Where(t => !string.IsNullOrEmpty(t.Genre))
            .Select(t => t.Genre!)
            .Distinct()
            .OrderBy(g => g)
            .ToListAsync();

        return Ok(ApiResponse<List<string>>.Ok(genres));
    }

    [HttpPost("tracks/{id}/favourite")]
    public async Task<IActionResult> ToggleFavourite(Guid id)
    {
        var track = await _context.Tracks.Include(t => t.MediaItem).FirstOrDefaultAsync(t => t.Id == id || t.MediaItemId == id);
        if (track?.MediaItem == null) return NotFound(ApiResponse<bool>.Fail("Track not found"));

        track.MediaItem.IsFavourite = !track.MediaItem.IsFavourite;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(track.MediaItem.IsFavourite, track.MediaItem.IsFavourite ? "Added to favourites" : "Removed from favourites"));
    }

    [HttpGet("tracks/{id}/lyrics")]
    public async Task<IActionResult> GetLyrics(Guid id, [FromQuery] bool force = false, CancellationToken ct = default)
    {
        var result = await _lyricsService.GetLyricsAsync(id, force, ct);
        return Ok(ApiResponse<LyricsResultDto>.Ok(result));
    }

    [HttpPost("tracks/{id}/lyrics/search")]
    public async Task<IActionResult> FetchLyrics(Guid id, [FromBody] FetchLyricsRequest request, CancellationToken ct = default)
    {
        var result = await _lyricsService.FetchAndSaveLyricsAsync(id, request, ct);
        return Ok(ApiResponse<LyricsResultDto>.Ok(result));
    }

    [HttpGet("lyrics/search")]
    public async Task<IActionResult> SearchOnlineLyrics([FromQuery] string query, CancellationToken ct = default)
    {
        var results = await _lyricsService.SearchOnlineLyricsAsync(query, ct);
        return Ok(ApiResponse<List<LrcLibSearchResultDto>>.Ok(results));
    }

    [HttpPost("tracks/{id}/lyrics/apply/{lrclibId:int}")]
    public async Task<IActionResult> ApplyOnlineLyrics(Guid id, int lrclibId, CancellationToken ct = default)
    {
        var result = await _lyricsService.ApplyOnlineLyricsAsync(id, lrclibId, ct);
        return Ok(ApiResponse<LyricsResultDto>.Ok(result));
    }

    [HttpPost("tracks/{id}/lyrics/autofetch")]
    public async Task<IActionResult> AutoFetchLyrics(Guid id, CancellationToken ct = default)
    {
        var result = await _lyricsService.AutoFetchSyncedLyricsAsync(id, ct);
        return Ok(ApiResponse<LyricsResultDto>.Ok(result));
    }

    [HttpPost("lyrics/translate")]
    public async Task<IActionResult> TranslateLyrics([FromBody] TranslateLyricsRequest request, CancellationToken ct = default)
    {
        var result = await _lyricsService.TranslateLyricsAsync(request, ct);
        return Ok(ApiResponse<TranslatedLyricsResultDto>.Ok(result));
    }
}
