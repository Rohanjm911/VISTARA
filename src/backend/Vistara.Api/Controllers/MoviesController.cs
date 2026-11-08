using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.Services.Metadata;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class MoviesController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly IMoviePosterService _posterService;

    public MoviesController(VistaraDbContext context, IMoviePosterService posterService)
    {
        _context = context;
        _posterService = posterService;
    }

    [HttpGet]
    public async Task<IActionResult> GetMovies(
        [FromQuery] string? genre = null,
        [FromQuery] int? year = null,
        [FromQuery] string? sortBy = "title",
        [FromQuery] bool descending = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24)
    {
        var query = _context.Movies
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.Genres)
                    .ThenInclude(g => g.Genre)
            .Include(m => m.Editions)
                .ThenInclude(e => e.MediaFile)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(genre))
        {
            query = query.Where(m => m.MediaItem!.Genres.Any(g => g.Genre!.Name.ToLower() == genre.ToLower()));
        }

        if (year.HasValue)
        {
            query = query.Where(m => m.MediaItem!.Year == year.Value);
        }

        query = (sortBy?.ToLower()) switch
        {
            "year" => descending ? query.OrderByDescending(m => m.MediaItem!.Year) : query.OrderBy(m => m.MediaItem!.Year),
            "rating" => descending ? query.OrderByDescending(m => m.MediaItem!.CommunityRating) : query.OrderBy(m => m.MediaItem!.CommunityRating),
            "added" => descending ? query.OrderByDescending(m => m.CreatedAtUtc) : query.OrderBy(m => m.CreatedAtUtc),
            _ => descending ? query.OrderByDescending(m => m.MediaItem!.Title) : query.OrderBy(m => m.MediaItem!.Title)
        };

        var totalCount = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = items.Select(m => MapToMovieDto(m)).ToList();
        return Ok(ApiResponse<PagedResult<MovieDto>>.Ok(new PagedResult<MovieDto>(dtos, totalCount, page, pageSize)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetMovie(Guid id)
    {
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.Genres)
                    .ThenInclude(g => g.Genre)
            .Include(m => m.Editions)
                .ThenInclude(e => e.MediaFile)
            .FirstOrDefaultAsync(m => m.MediaItemId == id || m.Id == id);

        if (movie == null) return NotFound(ApiResponse<MovieDto>.Fail("Movie not found"));

        var progress = await _context.PlaybackProgress
            .FirstOrDefaultAsync(p => p.MediaItemId == movie.MediaItemId);

        var dto = MapToMovieDto(movie);
        if (progress != null)
        {
            dto.Progress = new PlaybackProgressDto
            {
                MediaItemId = progress.MediaItemId,
                MediaFileId = progress.MediaFileId,
                PositionSeconds = progress.PositionSeconds,
                DurationSeconds = progress.DurationSeconds,
                PercentageWatched = progress.PercentageWatched,
                IsCompleted = progress.IsCompleted
            };
        }

        return Ok(ApiResponse<MovieDto>.Ok(dto));
    }

    [HttpPost("{id}/favourite")]
    public async Task<IActionResult> ToggleFavourite(Guid id)
    {
        var item = await _context.MediaItems.FirstOrDefaultAsync(m => m.Id == id);
        if (item == null) return NotFound(ApiResponse<bool>.Fail("Media item not found"));

        item.IsFavourite = !item.IsFavourite;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(item.IsFavourite, item.IsFavourite ? "Added to favourites" : "Removed from favourites"));
    }

    [HttpPost("{id}/watchlist")]
    public async Task<IActionResult> ToggleWatchlist(Guid id)
    {
        var item = await _context.MediaItems.FirstOrDefaultAsync(m => m.Id == id);
        if (item == null) return NotFound(ApiResponse<bool>.Fail("Media item not found"));

        item.IsInWatchlist = !item.IsInWatchlist;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(item.IsInWatchlist, item.IsInWatchlist ? "Added to watchlist" : "Removed from watchlist"));
    }

    [HttpGet("{id}/poster-search")]
    public async Task<IActionResult> SearchPosters(Guid id, [FromQuery] string? query = null)
    {
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
            .FirstOrDefaultAsync(m => m.MediaItemId == id || m.Id == id);

        var searchQuery = !string.IsNullOrWhiteSpace(query)
            ? query
            : (movie?.MediaItem?.Title ?? string.Empty);

        var candidates = await _posterService.SearchPostersAsync(searchQuery);
        return Ok(ApiResponse<List<PosterSearchResultDto>>.Ok(candidates));
    }

    [HttpPost("{id}/import-poster-url")]
    public async Task<IActionResult> ImportPosterUrl(Guid id, [FromBody] ImportPosterRequestDto request)
    {
        var ok = await _posterService.ImportPosterAsync(id, request);
        if (!ok) return BadRequest(ApiResponse<MovieDto>.Fail("Failed to import poster from URL"));

        var movie = await _context.Movies
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.Genres).ThenInclude(g => g.Genre)
            .Include(m => m.Editions).ThenInclude(e => e.MediaFile)
            .FirstOrDefaultAsync(m => m.MediaItemId == id || m.Id == id);

        if (movie == null) return NotFound(ApiResponse<MovieDto>.Fail("Movie not found"));
        return Ok(ApiResponse<MovieDto>.Ok(MapToMovieDto(movie), "Poster updated successfully"));
    }

    [HttpPost("{id}/upload-poster")]
    public async Task<IActionResult> UploadPoster(Guid id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<MovieDto>.Fail("No file provided"));

        using var stream = file.OpenReadStream();
        var ok = await _posterService.UploadPosterAsync(id, stream, file.FileName);
        if (!ok) return BadRequest(ApiResponse<MovieDto>.Fail("Failed to upload poster"));

        var movie = await _context.Movies
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.Genres).ThenInclude(g => g.Genre)
            .Include(m => m.Editions).ThenInclude(e => e.MediaFile)
            .FirstOrDefaultAsync(m => m.MediaItemId == id || m.Id == id);

        if (movie == null) return NotFound(ApiResponse<MovieDto>.Fail("Movie not found"));
        return Ok(ApiResponse<MovieDto>.Ok(MapToMovieDto(movie), "Custom poster uploaded successfully"));
    }

    [HttpPost("{id}/auto-fetch-poster")]
    public async Task<IActionResult> AutoFetchPoster(Guid id)
    {
        var ok = await _posterService.AutoFetchSinglePosterAsync(id);
        if (!ok) return BadRequest(ApiResponse<MovieDto>.Fail("Could not find matching poster online"));

        var movie = await _context.Movies
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.Genres).ThenInclude(g => g.Genre)
            .Include(m => m.Editions).ThenInclude(e => e.MediaFile)
            .FirstOrDefaultAsync(m => m.MediaItemId == id || m.Id == id);

        if (movie == null) return NotFound(ApiResponse<MovieDto>.Fail("Movie not found"));
        return Ok(ApiResponse<MovieDto>.Ok(MapToMovieDto(movie), "Poster automatically fetched"));
    }

    [HttpPost("{id}/auto-fetch-description")]
    public async Task<IActionResult> AutoFetchDescription(Guid id)
    {
        var ok = await _posterService.AutoFetchDescriptionOnlyAsync(id);
        if (!ok) return BadRequest(ApiResponse<MovieDto>.Fail("Could not find matching description online"));

        var movie = await _context.Movies
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem).ThenInclude(mi => mi!.Genres).ThenInclude(g => g.Genre)
            .Include(m => m.Editions).ThenInclude(e => e.MediaFile)
            .FirstOrDefaultAsync(m => m.MediaItemId == id || m.Id == id);

        if (movie == null) return NotFound(ApiResponse<MovieDto>.Fail("Movie not found"));
        return Ok(ApiResponse<MovieDto>.Ok(MapToMovieDto(movie), "Description automatically fetched"));
    }

    [HttpPost("auto-fetch-all-posters")]
    public async Task<IActionResult> AutoFetchAllPosters()
    {
        var result = await _posterService.AutoFetchAllPostersAsync();
        return Ok(ApiResponse<AutoFetchAllResultDto>.Ok(result, $"Auto-fetch complete: {result.UpdatedCount} posters updated out of {result.TotalScanned} movies."));
    }

    private static MovieDto MapToMovieDto(Movie m) => new()
    {
        Id = m.MediaItemId,
        MovieId = m.Id,
        Title = m.MediaItem?.Title ?? string.Empty,
        OriginalTitle = m.MediaItem?.OriginalTitle,
        Year = m.MediaItem?.Year,
        Overview = m.MediaItem?.Overview,
        Tagline = m.MediaItem?.Tagline,
        RuntimeMinutes = m.MediaItem?.RuntimeMinutes,
        CommunityRating = m.MediaItem?.CommunityRating,
        ContentRating = m.MediaItem?.ContentRating,
        Director = m.Director,
        Writers = m.Writers,
        Cast = m.Cast,
        Studio = m.Studio,
        IsFavourite = m.MediaItem?.IsFavourite ?? false,
        IsInWatchlist = m.MediaItem?.IsInWatchlist ?? false,
        PosterUrl = m.MediaItem?.PrimaryArtwork != null ? $"/api/v1/artwork/{m.MediaItem.PrimaryArtwork.Id}" : null,
        BackdropUrl = m.MediaItem?.BackdropArtwork != null ? $"/api/v1/artwork/{m.MediaItem.BackdropArtwork.Id}" : null,
        Genres = m.MediaItem?.Genres.Select(g => g.Genre?.Name ?? "").Where(n => !string.IsNullOrEmpty(n)).ToList() ?? new(),
        Editions = m.Editions.Select(e => new MovieEditionDto
        {
            Id = e.Id,
            MediaFileId = e.MediaFileId,
            EditionName = e.EditionName,
            ResolutionLabel = e.ResolutionLabel,
            FileSizeBytes = e.MediaFile?.FileSizeBytes ?? 0,
            ContainerFormat = e.MediaFile?.ContainerFormat,
            VideoCodec = e.MediaFile?.VideoCodec,
            AudioCodec = e.MediaFile?.AudioCodec,
            DurationSeconds = e.MediaFile?.DurationSeconds ?? 0,
            IsMissing = e.MediaFile?.IsMissing ?? false
        }).ToList()
    };
}

