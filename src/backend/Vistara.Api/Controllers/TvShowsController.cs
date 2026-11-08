using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.Services.Metadata;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/v1/shows")]
public class TvShowsController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly IMoviePosterService _posterService;

    public TvShowsController(VistaraDbContext context, IMoviePosterService posterService)
    {
        _context = context;
        _posterService = posterService;
    }

    [HttpGet]
    public async Task<IActionResult> GetShows([FromQuery] int page = 1, [FromQuery] int pageSize = 24)
    {
        var query = _context.TVShows
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Include(s => s.Seasons)
                .ThenInclude(se => se.Episodes)
            .OrderBy(s => s.MediaItem!.Title);

        var totalCount = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var dtos = items.Select(s => new TVShowDto
        {
            Id = s.MediaItemId,
            ShowId = s.Id,
            Title = s.MediaItem?.Title ?? string.Empty,
            Year = s.MediaItem?.Year,
            Overview = s.MediaItem?.Overview,
            Network = s.Network,
            Status = s.Status,
            Cast = s.Cast,
            CommunityRating = s.MediaItem?.CommunityRating,
            IsFavourite = s.MediaItem?.IsFavourite ?? false,
            IsInWatchlist = s.MediaItem?.IsInWatchlist ?? false,
            PosterUrl = s.MediaItem?.PrimaryArtwork != null 
                ? $"/api/v1/artwork/{s.MediaItem.PrimaryArtwork.Id}" 
                : (s.Seasons.SelectMany(se => se.Episodes).FirstOrDefault(e => e.StillArtwork != null)?.StillArtwork != null 
                    ? $"/api/v1/artwork/{s.Seasons.SelectMany(se => se.Episodes).First(e => e.StillArtwork != null).StillArtwork!.Id}" 
                    : null),
            BackdropUrl = s.MediaItem?.BackdropArtwork != null ? $"/api/v1/artwork/{s.MediaItem.BackdropArtwork.Id}" : null,
            SeasonCount = s.Seasons.Count,
            EpisodeCount = s.Seasons.Sum(se => se.Episodes.Count)
        }).ToList();

        return Ok(ApiResponse<PagedResult<TVShowDto>>.Ok(new PagedResult<TVShowDto>(dtos, totalCount, page, pageSize)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetShow(Guid id)
    {
        var show = await _context.TVShows
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Include(s => s.Seasons.OrderBy(se => se.SeasonNumber))
                .ThenInclude(se => se.Episodes.OrderBy(e => e.EpisodeNumber))
                    .ThenInclude(e => e.MediaItem)
                        .ThenInclude(m => m!.Files)
            .Include(s => s.Seasons)
                .ThenInclude(se => se.Episodes)
                    .ThenInclude(e => e.StillArtwork)
            .FirstOrDefaultAsync(s => s.MediaItemId == id || s.Id == id);

        if (show == null) return NotFound(ApiResponse<TVShowDto>.Fail("Show not found"));

        var episodeItemIds = show.Seasons.SelectMany(s => s.Episodes).Select(e => e.MediaItemId).ToList();
        var progressMap = await _context.PlaybackProgress
            .Where(p => episodeItemIds.Contains(p.MediaItemId))
            .ToDictionaryAsync(p => p.MediaItemId);

        var dto = new TVShowDetailsDto
        {
            Id = show.MediaItemId,
            ShowId = show.Id,
            Title = show.MediaItem?.Title ?? string.Empty,
            Year = show.MediaItem?.Year,
            Overview = show.MediaItem?.Overview,
            Network = show.Network,
            Status = show.Status,
            Cast = show.Cast,
            CommunityRating = show.MediaItem?.CommunityRating,
            IsFavourite = show.MediaItem?.IsFavourite ?? false,
            IsInWatchlist = show.MediaItem?.IsInWatchlist ?? false,
            PosterUrl = show.MediaItem?.PrimaryArtwork != null 
                ? $"/api/v1/artwork/{show.MediaItem.PrimaryArtwork.Id}" 
                : (show.Seasons.SelectMany(se => se.Episodes).FirstOrDefault(e => e.StillArtwork != null)?.StillArtwork != null 
                    ? $"/api/v1/artwork/{show.Seasons.SelectMany(se => se.Episodes).First(e => e.StillArtwork != null).StillArtwork!.Id}" 
                    : null),
            BackdropUrl = show.MediaItem?.BackdropArtwork != null ? $"/api/v1/artwork/{show.MediaItem.BackdropArtwork.Id}" : null,
            SeasonCount = show.Seasons.Count,
            EpisodeCount = show.Seasons.Sum(se => se.Episodes.Count),
            Seasons = show.Seasons.Select(se => new SeasonDto
            {
                Id = se.Id,
                TVShowId = se.TVShowId,
                SeasonNumber = se.SeasonNumber,
                Title = se.Title,
                Overview = se.Overview,
                PosterUrl = se.PosterArtwork != null ? $"/api/v1/artwork/{se.PosterArtwork.Id}" : null,
                Episodes = se.Episodes.Select(e =>
                {
                    progressMap.TryGetValue(e.MediaItemId, out var p);
                    return new EpisodeDto
                    {
                        Id = e.MediaItemId,
                        EpisodeId = e.Id,
                        SeasonId = e.SeasonId,
                        SeasonNumber = se.SeasonNumber,
                        EpisodeNumber = e.EpisodeNumber,
                        Title = e.Title,
                        Overview = e.Overview,
                        AirDate = e.AirDate,
                        IntroStartSeconds = e.IntroStartSeconds,
                        IntroEndSeconds = e.IntroEndSeconds,
                        CreditsStartSeconds = e.CreditsStartSeconds,
                        StillUrl = e.StillArtwork != null 
                            ? $"/api/v1/artwork/{e.StillArtwork.Id}" 
                            : (e.MediaItem?.PrimaryArtwork != null ? $"/api/v1/artwork/{e.MediaItem.PrimaryArtwork.Id}" : null),
                        DurationSeconds = e.MediaItem?.Files.FirstOrDefault()?.DurationSeconds ?? 0,
                        MediaFileId = e.MediaItem?.Files.FirstOrDefault()?.Id ?? Guid.Empty,
                        Progress = p != null ? new PlaybackProgressDto
                        {
                            MediaItemId = p.MediaItemId,
                            MediaFileId = p.MediaFileId,
                            PositionSeconds = p.PositionSeconds,
                            DurationSeconds = p.DurationSeconds,
                            PercentageWatched = p.PercentageWatched,
                            IsCompleted = p.IsCompleted
                        } : null
                    };
                }).ToList()
            }).ToList()
        };

        return Ok(ApiResponse<TVShowDetailsDto>.Ok(dto));
    }
    [HttpPost("{id}/favourite")]
    public async Task<IActionResult> ToggleFavourite(Guid id)
    {
        var show = await _context.TVShows.Include(s => s.MediaItem).FirstOrDefaultAsync(s => s.Id == id || s.MediaItemId == id);
        if (show?.MediaItem == null) return NotFound(ApiResponse<bool>.Fail("TV show not found"));

        show.MediaItem.IsFavourite = !show.MediaItem.IsFavourite;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(show.MediaItem.IsFavourite, show.MediaItem.IsFavourite ? "Added to favourites" : "Removed from favourites"));
    }

    [HttpPost("{id}/watchlist")]
    public async Task<IActionResult> ToggleWatchlist(Guid id)
    {
        var show = await _context.TVShows.Include(s => s.MediaItem).FirstOrDefaultAsync(s => s.Id == id || s.MediaItemId == id);
        if (show?.MediaItem == null) return NotFound(ApiResponse<bool>.Fail("TV show not found"));

        show.MediaItem.IsInWatchlist = !show.MediaItem.IsInWatchlist;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(show.MediaItem.IsInWatchlist, show.MediaItem.IsInWatchlist ? "Added to watchlist" : "Removed from watchlist"));
    }

    [HttpGet("{id}/poster-search")]
    public async Task<IActionResult> SearchTvPosters(Guid id, [FromQuery] string? query = null)
    {
        var show = await _context.TVShows
            .Include(s => s.MediaItem)
            .FirstOrDefaultAsync(s => s.Id == id || s.MediaItemId == id);

        var searchTerm = !string.IsNullOrWhiteSpace(query)
            ? query
            : (show?.MediaItem?.Title ?? string.Empty);

        if (string.IsNullOrWhiteSpace(searchTerm))
            return BadRequest(ApiResponse<List<PosterSearchResultDto>>.Fail("Search query cannot be empty"));

        var results = await _posterService.SearchTvPostersAsync(searchTerm);
        return Ok(ApiResponse<List<PosterSearchResultDto>>.Ok(results));
    }

    [HttpPost("{id}/import-poster-url")]
    public async Task<IActionResult> ImportTvPosterUrl(Guid id, [FromBody] ImportPosterRequestDto request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.PosterUrl))
            return BadRequest(ApiResponse<TVShowDto>.Fail("Poster URL is required"));

        var ok = await _posterService.ImportTvPosterAsync(id, request);
        if (!ok) return BadRequest(ApiResponse<TVShowDto>.Fail("Failed to download or apply series poster"));

        var show = await GetShowDtoById(id);
        if (show == null) return NotFound(ApiResponse<TVShowDto>.Fail("Show not found"));

        return Ok(ApiResponse<TVShowDto>.Ok(show, "Series poster updated successfully"));
    }

    [HttpPost("{id}/upload-poster")]
    public async Task<IActionResult> UploadTvPoster(Guid id, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse<TVShowDto>.Fail("No file provided"));

        using var stream = file.OpenReadStream();
        var ok = await _posterService.UploadTvPosterAsync(id, stream, file.FileName);
        if (!ok) return BadRequest(ApiResponse<TVShowDto>.Fail("Failed to upload series poster"));

        var show = await GetShowDtoById(id);
        if (show == null) return NotFound(ApiResponse<TVShowDto>.Fail("Show not found"));

        return Ok(ApiResponse<TVShowDto>.Ok(show, "Custom series poster uploaded successfully"));
    }

    [HttpPost("{id}/auto-fetch-poster")]
    public async Task<IActionResult> AutoFetchTvPoster(Guid id)
    {
        var ok = await _posterService.AutoFetchSingleTvPosterAsync(id);
        if (!ok) return BadRequest(ApiResponse<TVShowDto>.Fail("Could not find matching series poster online"));

        var show = await GetShowDtoById(id);
        if (show == null) return NotFound(ApiResponse<TVShowDto>.Fail("Show not found"));

        return Ok(ApiResponse<TVShowDto>.Ok(show, "Series poster automatically fetched"));
    }

    [HttpPost("auto-fetch-all-posters")]
    public async Task<IActionResult> AutoFetchAllTvPosters()
    {
        var result = await _posterService.AutoFetchAllTvPostersAsync();
        return Ok(ApiResponse<AutoFetchAllResultDto>.Ok(result, $"Auto-fetch complete: {result.UpdatedCount} series posters updated out of {result.TotalScanned} shows."));
    }

    private async Task<TVShowDto?> GetShowDtoById(Guid id)
    {
        var s = await _context.TVShows
            .Include(s => s.MediaItem).ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(s => s.MediaItem).ThenInclude(mi => mi!.BackdropArtwork)
            .Include(s => s.Seasons).ThenInclude(se => se.Episodes)
            .FirstOrDefaultAsync(s => s.Id == id || s.MediaItemId == id);

        if (s == null) return null;

        return new TVShowDto
        {
            Id = s.MediaItemId,
            ShowId = s.Id,
            Title = s.MediaItem?.Title ?? string.Empty,
            Year = s.MediaItem?.Year,
            Overview = s.MediaItem?.Overview,
            Network = s.Network,
            Status = s.Status,
            Cast = s.Cast,
            CommunityRating = s.MediaItem?.CommunityRating,
            IsFavourite = s.MediaItem?.IsFavourite ?? false,
            IsInWatchlist = s.MediaItem?.IsInWatchlist ?? false,
            PosterUrl = s.MediaItem?.PrimaryArtwork != null 
                ? $"/api/v1/artwork/{s.MediaItem.PrimaryArtwork.Id}" 
                : null,
            BackdropUrl = s.MediaItem?.BackdropArtwork != null ? $"/api/v1/artwork/{s.MediaItem.BackdropArtwork.Id}" : null,
            SeasonCount = s.Seasons.Count,
            EpisodeCount = s.Seasons.Sum(se => se.Episodes.Count)
        };
    }
}

public class TVShowDetailsDto : TVShowDto
{
    public List<SeasonDto> Seasons { get; set; } = new();
}
