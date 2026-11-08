using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Infrastructure.Data;
using Vistara.Services.Tasks;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly IBackgroundTaskManager _taskManager;

    public DashboardController(VistaraDbContext context, IBackgroundTaskManager taskManager)
    {
        _context = context;
        _taskManager = taskManager;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var dashboard = new DashboardDto();

        // 1. Continue Watching Movies & Episodes
        var inProgressProgress = await _context.PlaybackProgress
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.Files)
            .Where(p => !p.IsCompleted && p.PositionSeconds > 10)
            .OrderByDescending(p => p.LastPlayedUtc)
            .Take(18)
            .ToListAsync();

        var movieItemIds = inProgressProgress
            .Where(p => p.MediaItem?.Type == MediaType.Movie)
            .Select(p => p.MediaItemId)
            .Distinct()
            .ToList();

        if (movieItemIds.Count > 0)
        {
            var movies = await _context.Movies
                .Include(m => m.MediaItem)
                    .ThenInclude(mi => mi!.PrimaryArtwork)
                .Include(m => m.MediaItem)
                    .ThenInclude(mi => mi!.BackdropArtwork)
                .Include(m => m.MediaItem)
                    .ThenInclude(mi => mi!.Genres)
                        .ThenInclude(g => g.Genre)
                .Include(m => m.Editions)
                    .ThenInclude(e => e.MediaFile)
                .Where(m => movieItemIds.Contains(m.MediaItemId))
                .ToListAsync();

            var moviesMap = movies.ToDictionary(m => m.MediaItemId);

            dashboard.ContinueWatchingMovies = movieItemIds
                .Where(id => moviesMap.ContainsKey(id))
                .Select(id =>
                {
                    var m = moviesMap[id];
                    var prog = inProgressProgress.FirstOrDefault(p => p.MediaItemId == m.MediaItemId);
                    var editions = m.Editions.Select(e => new MovieEditionDto
                    {
                        Id = e.Id,
                        MediaFileId = e.MediaFileId,
                        EditionName = e.EditionName,
                        ResolutionLabel = e.ResolutionLabel,
                        DurationSeconds = e.MediaFile?.DurationSeconds ?? 0
                    }).ToList();

                    if (editions.Count == 0 && prog != null && prog.MediaFileId != Guid.Empty)
                    {
                        editions.Add(new MovieEditionDto
                        {
                            Id = Guid.NewGuid(),
                            MediaFileId = prog.MediaFileId,
                            EditionName = "Theatrical",
                            DurationSeconds = prog.DurationSeconds
                        });
                    }

                    return new MovieDto
                    {
                        Id = m.MediaItemId,
                        MovieId = m.Id,
                        Title = m.MediaItem!.Title,
                        Year = m.MediaItem.Year,
                        Overview = m.MediaItem.Overview,
                        Tagline = m.MediaItem.Tagline,
                        RuntimeMinutes = m.MediaItem.RuntimeMinutes,
                        CommunityRating = m.MediaItem.CommunityRating,
                        PosterUrl = m.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{m.MediaItem.PrimaryArtwork.Id}" : null,
                        BackdropUrl = m.MediaItem.BackdropArtwork != null ? $"/api/v1/artwork/{m.MediaItem.BackdropArtwork.Id}" : null,
                        Genres = m.MediaItem.Genres.Select(g => g.Genre?.Name ?? "").Where(n => !string.IsNullOrEmpty(n)).ToList(),
                        Editions = editions,
                        Progress = prog != null ? new PlaybackProgressDto
                        {
                            MediaItemId = prog.MediaItemId,
                            MediaFileId = prog.MediaFileId,
                            PositionSeconds = prog.PositionSeconds,
                            DurationSeconds = prog.DurationSeconds,
                            PercentageWatched = prog.PercentageWatched,
                            IsCompleted = prog.IsCompleted,
                            LastPlayedUtc = prog.LastPlayedUtc,
                            SelectedAudioStreamIndex = prog.SelectedAudioStreamIndex,
                            SelectedSubtitleStreamIndex = prog.SelectedSubtitleStreamIndex
                        } : null
                    };
                }).ToList();
        }

        var episodeItemIds = inProgressProgress
            .Where(p => p.MediaItem?.Type == MediaType.Episode)
            .Select(p => p.MediaItemId)
            .Distinct()
            .ToList();

        if (episodeItemIds.Count > 0)
        {
            var episodes = await _context.Episodes
                .Include(e => e.MediaItem)
                    .ThenInclude(mi => mi!.PrimaryArtwork)
                .Include(e => e.MediaItem)
                    .ThenInclude(mi => mi!.Files)
                .Include(e => e.Season)
                    .ThenInclude(s => s.TVShow)
                        .ThenInclude(show => show.MediaItem)
                            .ThenInclude(showMi => showMi!.PrimaryArtwork)
                .Where(e => episodeItemIds.Contains(e.MediaItemId))
                .ToListAsync();

            var episodesMap = episodes.ToDictionary(e => e.MediaItemId);

            dashboard.ContinueWatchingEpisodes = episodeItemIds
                .Where(id => episodesMap.ContainsKey(id))
                .Select(id =>
                {
                    var ep = episodesMap[id];
                    var prog = inProgressProgress.FirstOrDefault(p => p.MediaItemId == ep.MediaItemId);
                    var showTitle = ep.Season?.TVShow?.MediaItem?.Title ?? "TV Show";
                    var fileId = prog?.MediaFileId != null && prog.MediaFileId != Guid.Empty
                        ? prog.MediaFileId
                        : (ep.MediaItem?.Files.FirstOrDefault()?.Id ?? Guid.Empty);
                    var stillArtworkId = ep.MediaItem?.PrimaryArtwork?.Id ?? ep.Season?.TVShow?.MediaItem?.PrimaryArtwork?.Id;

                    return new EpisodeDto
                    {
                        Id = ep.MediaItemId,
                        EpisodeId = ep.Id,
                        SeasonId = ep.SeasonId,
                        SeasonNumber = ep.Season?.SeasonNumber ?? 1,
                        EpisodeNumber = ep.EpisodeNumber,
                        Title = ep.Title,
                        SeriesTitle = showTitle,
                        Overview = ep.Overview,
                        AirDate = ep.AirDate,
                        IntroStartSeconds = ep.IntroStartSeconds,
                        IntroEndSeconds = ep.IntroEndSeconds,
                        CreditsStartSeconds = ep.CreditsStartSeconds,
                        DurationSeconds = ep.MediaItem?.Files.FirstOrDefault()?.DurationSeconds ?? prog?.DurationSeconds ?? 0,
                        MediaFileId = fileId,
                        StillUrl = stillArtworkId.HasValue ? $"/api/v1/artwork/{stillArtworkId.Value}" : null,
                        Progress = prog != null ? new PlaybackProgressDto
                        {
                            MediaItemId = prog.MediaItemId,
                            MediaFileId = prog.MediaFileId,
                            PositionSeconds = prog.PositionSeconds,
                            DurationSeconds = prog.DurationSeconds,
                            PercentageWatched = prog.PercentageWatched,
                            IsCompleted = prog.IsCompleted,
                            LastPlayedUtc = prog.LastPlayedUtc,
                            SelectedAudioStreamIndex = prog.SelectedAudioStreamIndex,
                            SelectedSubtitleStreamIndex = prog.SelectedSubtitleStreamIndex
                        } : null
                    };
                }).ToList();
        }

        // 2. Recently Added Movies
        dashboard.RecentlyAddedMovies = await _context.Movies
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.Genres)
                    .ThenInclude(g => g.Genre)
            .Include(m => m.Editions)
                .ThenInclude(e => e.MediaFile)
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(12)
            .Select(m => new MovieDto
            {
                Id = m.MediaItemId,
                MovieId = m.Id,
                Title = m.MediaItem!.Title,
                Year = m.MediaItem.Year,
                RuntimeMinutes = m.MediaItem.RuntimeMinutes,
                CommunityRating = m.MediaItem.CommunityRating,
                Overview = m.MediaItem.Overview,
                Tagline = m.MediaItem.Tagline,
                PosterUrl = m.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{m.MediaItem.PrimaryArtwork.Id}" : null,
                BackdropUrl = m.MediaItem.BackdropArtwork != null ? $"/api/v1/artwork/{m.MediaItem.BackdropArtwork.Id}" : null,
                Genres = m.MediaItem.Genres.Select(g => g.Genre != null ? g.Genre.Name : "").Where(n => !string.IsNullOrEmpty(n)).ToList(),
                Editions = m.Editions.Select(e => new MovieEditionDto
                {
                    Id = e.Id,
                    MediaFileId = e.MediaFileId,
                    EditionName = e.EditionName,
                    ResolutionLabel = e.ResolutionLabel,
                    DurationSeconds = e.MediaFile != null ? e.MediaFile.DurationSeconds : 0
                }).ToList()
            })
            .ToListAsync();

        // 3. Recently Added TV Shows
        dashboard.RecentlyAddedShows = await _context.TVShows
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Include(s => s.Seasons)
                .ThenInclude(se => se.Episodes)
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(12)
            .Select(s => new TVShowDto
            {
                Id = s.MediaItemId,
                ShowId = s.Id,
                Title = s.MediaItem!.Title,
                Year = s.MediaItem.Year,
                Overview = s.MediaItem.Overview,
                CommunityRating = s.MediaItem.CommunityRating,
                PosterUrl = s.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{s.MediaItem.PrimaryArtwork.Id}" : null,
                BackdropUrl = s.MediaItem.BackdropArtwork != null ? $"/api/v1/artwork/{s.MediaItem.BackdropArtwork.Id}" : null,
                SeasonCount = s.Seasons.Count,
                EpisodeCount = s.Seasons.Sum(se => se.Episodes.Count)
            })
            .ToListAsync();

        // 4. Favourite Movies
        dashboard.FavouriteMovies = await _context.Movies
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.BackdropArtwork)
            .Where(m => m.MediaItem!.IsFavourite)
            .Take(12)
            .Select(m => new MovieDto
            {
                Id = m.MediaItemId,
                MovieId = m.Id,
                Title = m.MediaItem!.Title,
                Year = m.MediaItem.Year,
                RuntimeMinutes = m.MediaItem.RuntimeMinutes,
                CommunityRating = m.MediaItem.CommunityRating,
                Overview = m.MediaItem.Overview,
                PosterUrl = m.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{m.MediaItem.PrimaryArtwork.Id}" : null,
                BackdropUrl = m.MediaItem.BackdropArtwork != null ? $"/api/v1/artwork/{m.MediaItem.BackdropArtwork.Id}" : null
            })
            .ToListAsync();

        // 5. Recently Played Music
        dashboard.RecentlyPlayedMusic = await _context.Tracks
            .Include(t => t.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(t => t.MediaItem)
                .ThenInclude(m => m!.Files)
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .OrderByDescending(t => t.UpdatedAtUtc)
            .Take(12)
            .Select(t => new TrackDto
            {
                Id = t.MediaItemId,
                TrackId = t.Id,
                Title = t.Title,
                ArtistName = t.Artist != null ? t.Artist.Name : "Unknown",
                AlbumTitle = t.Album != null ? t.Album.Title : "Unknown",
                DurationSeconds = t.DurationSeconds,
                MediaFileId = t.MediaItem != null && t.MediaItem.Files.FirstOrDefault() != null ? t.MediaItem.Files.FirstOrDefault()!.Id : Guid.Empty,
                ArtworkUrl = t.MediaItem.PrimaryArtwork != null ? $"/api/v1/artwork/{t.MediaItem.PrimaryArtwork.Id}" : null
            })
            .ToListAsync();

        // 6. Recently Added Photos
        dashboard.RecentlyAddedPhotos = await _context.Photos
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.PrimaryArtwork)
            .Include(p => p.MediaItem)
                .ThenInclude(m => m!.Files)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Take(12)
            .Select(p => new PhotoDto
            {
                Id = p.MediaItemId,
                PhotoId = p.Id,
                Title = p.MediaItem != null ? p.MediaItem.Title : "Untitled",
                DateTakenUtc = p.DateTakenUtc,
                ThumbnailUrl = p.MediaItem != null && p.MediaItem.PrimaryArtwork != null
                    ? $"/api/v1/artwork/{p.MediaItem.PrimaryArtwork.Id}"
                    : (p.MediaItem != null && p.MediaItem.Files.FirstOrDefault() != null
                        ? $"/api/v1/stream/{p.MediaItem.Files.FirstOrDefault()!.Id}"
                        : null),
                FullImageUrl = p.MediaItem != null && p.MediaItem.Files.FirstOrDefault() != null
                    ? $"/api/v1/stream/{p.MediaItem.Files.FirstOrDefault()!.Id}"
                    : string.Empty,
                MediaFileId = p.MediaItem != null && p.MediaItem.Files.FirstOrDefault() != null
                    ? p.MediaItem.Files.FirstOrDefault()!.Id
                    : Guid.Empty
            })
            .ToListAsync();

        // 7. Library Statistics
        var totalWatchSeconds = await _context.PlaybackProgress
            .Select(p => (double?)p.PositionSeconds)
            .SumAsync() ?? 0.0;

        dashboard.Statistics = new LibraryStatisticsDto
        {
            TotalMovies = await _context.Movies.CountAsync(),
            TotalShows = await _context.TVShows.CountAsync(),
            TotalEpisodes = await _context.Episodes.CountAsync(),
            TotalTracks = await _context.Tracks.CountAsync(),
            TotalAlbums = await _context.Albums.CountAsync(),
            TotalArtists = await _context.Artists.CountAsync(),
            TotalPhotos = await _context.Photos.CountAsync(),
            TotalPlaylists = await _context.Playlists.CountAsync(),
            TotalWatchTimeHours = Math.Round(totalWatchSeconds / 3600.0, 1)
        };

        // 8. Storage Usage
        var movieFilesSize = await _context.MediaFiles
            .Where(f => f.MediaItem!.Type == MediaType.Movie)
            .Select(f => (long?)f.FileSizeBytes)
            .SumAsync() ?? 0L;

        var tvFilesSize = await _context.MediaFiles
            .Where(f => f.MediaItem!.Type == MediaType.Episode)
            .Select(f => (long?)f.FileSizeBytes)
            .SumAsync() ?? 0L;

        var musicFilesSize = await _context.MediaFiles
            .Where(f => f.MediaItem!.Type == MediaType.Track)
            .Select(f => (long?)f.FileSizeBytes)
            .SumAsync() ?? 0L;

        var photoFilesSize = await _context.MediaFiles
            .Where(f => f.MediaItem!.Type == MediaType.Photo)
            .Select(f => (long?)f.FileSizeBytes)
            .SumAsync() ?? 0L;

        dashboard.StorageUsage = new StorageUsageDto
        {
            MoviesSizeBytes = movieFilesSize,
            TvShowsSizeBytes = tvFilesSize,
            MusicSizeBytes = musicFilesSize,
            PhotosSizeBytes = photoFilesSize
        };

        // 9. Active Jobs
        dashboard.ActiveJobs = _taskManager.GetActiveJobs();

        return Ok(ApiResponse<DashboardDto>.Ok(dashboard));
    }
}

