using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Services.Metadata;

public interface IMoviePosterService
{
    string CleanTitle(string rawTitle);
    Task<List<PosterSearchResultDto>> SearchPostersAsync(string query, CancellationToken ct = default);
    Task<bool> ImportPosterAsync(Guid mediaItemId, ImportPosterRequestDto request, CancellationToken ct = default);
    Task<bool> UploadPosterAsync(Guid mediaItemId, Stream stream, string fileName, CancellationToken ct = default);
    Task<bool> AutoFetchSinglePosterAsync(Guid mediaItemId, CancellationToken ct = default);
    Task<bool> AutoFetchDescriptionOnlyAsync(Guid mediaItemId, CancellationToken ct = default);
    Task<AutoFetchAllResultDto> AutoFetchAllPostersAsync(CancellationToken ct = default);

    // TV Series & Web Series Methods
    Task<List<PosterSearchResultDto>> SearchTvPostersAsync(string query, CancellationToken ct = default);
    Task<bool> ImportTvPosterAsync(Guid showIdOrMediaItemId, ImportPosterRequestDto request, CancellationToken ct = default);
    Task<bool> UploadTvPosterAsync(Guid showIdOrMediaItemId, Stream stream, string fileName, CancellationToken ct = default);
    Task<bool> AutoFetchSingleTvPosterAsync(Guid showIdOrMediaItemId, CancellationToken ct = default);
    Task<AutoFetchAllResultDto> AutoFetchAllTvPostersAsync(CancellationToken ct = default);
}

public class MoviePosterService : IMoviePosterService
{
    private readonly VistaraDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<MoviePosterService> _logger;
    private readonly string _cacheDirectory;

    public MoviePosterService(
        VistaraDbContext context,
        HttpClient httpClient,
        ILogger<MoviePosterService> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;

        _httpClient.DefaultRequestHeaders.UserAgent.Clear();
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) VISTARA/1.0");
        _httpClient.Timeout = TimeSpan.FromSeconds(8);

        _cacheDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "cache", "thumbnails");
        Directory.CreateDirectory(_cacheDirectory);
    }

    public string CleanTitle(string rawTitle)
    {
        if (string.IsNullOrWhiteSpace(rawTitle)) return string.Empty;

        var title = rawTitle;

        // 1. Remove bracketed release / tracker info [60FPS], (Movies4u Foo), [YTS], [1080p]
        title = Regex.Replace(title, @"\[.*?\]|\(.*?\)", " ");

        // 2. Remove leading track / disk / numeric prefix: e.g. "1 ", "2 ", "01 - ", "5 "
        title = Regex.Replace(title, @"^\s*\d+[\s\.\-_]+", "");

        // 3. Remove common resolution / codec / video release terms
        var tags = new[]
        {
            "1080p", "720p", "2160p", "4k", "bluray", "brrip", "web-dl", "webrip",
            "x264", "x265", "hevc", "dvdrip", "remux", "60fps", "uhd", "hdrip",
            "extended", "theatrical", "unrated", "director's cut", "directors cut"
        };
        foreach (var tag in tags)
        {
            title = Regex.Replace(title, $@"\b{Regex.Escape(tag)}\b", " ", RegexOptions.IgnoreCase);
        }

        // 4. Handle franchise numbering: e.g. "X-Men 1" -> "X-Men", "X-Men 5 First Class" -> "X-Men First Class"
        title = Regex.Replace(title, @"\bX-Men\s+\d+\s+", "X-Men ", RegexOptions.IgnoreCase);
        title = Regex.Replace(title, @"\bX-Men\s+1\b", "X-Men", RegexOptions.IgnoreCase);

        // 5. Remove trailing single digit " 1" (common rip naming e.g. Movie 1)
        title = Regex.Replace(title, @"\s+1$", "");

        // 6. Clean dots, underscores, hyphens, and normalize multiple spaces
        title = title.Replace('.', ' ').Replace('_', ' ');
        title = Regex.Replace(title, @"\s+", " ").Trim();

        return title;
    }

    public async Task<List<PosterSearchResultDto>> SearchPostersAsync(string query, CancellationToken ct = default)
    {
        var cleanQuery = CleanTitle(query);
        if (string.IsNullOrWhiteSpace(cleanQuery)) cleanQuery = query.Trim();
        if (string.IsNullOrWhiteSpace(cleanQuery)) return new();

        var results = new List<PosterSearchResultDto>();
        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Helper to query OMDB by title
        async Task TryOmdbTitleSearch(string term)
        {
            try
            {
                var omdbTitleUrl = $"https://www.omdbapi.com/?t={Uri.EscapeDataString(term)}&apikey=trilogy";
                var omdbItem = await _httpClient.GetFromJsonAsync<OmdbDetailResponse>(omdbTitleUrl, ct);

                if (omdbItem != null && omdbItem.Response == "True" && !string.IsNullOrWhiteSpace(omdbItem.Poster) && omdbItem.Poster != "N/A")
                {
                    var id = omdbItem.ImdbID ?? omdbItem.Title;
                    if (!seenIds.Contains(id))
                    {
                        seenIds.Add(id);
                        var genresList = (omdbItem.Genre ?? "")
                            .Split(',', StringSplitOptions.RemoveEmptyEntries)
                            .Select(g => g.Trim())
                            .ToList();

                        double? rating = null;
                        if (double.TryParse(omdbItem.ImdbRating, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var r))
                            rating = r;

                        results.Add(new PosterSearchResultDto
                        {
                            Title = omdbItem.Title,
                            Year = omdbItem.Year,
                            ImdbId = omdbItem.ImdbID,
                            PosterUrl = omdbItem.Poster,
                            Overview = omdbItem.Plot,
                            Genres = genresList,
                            Rating = rating,
                            Director = omdbItem.Director != "N/A" ? omdbItem.Director : null,
                            Cast = omdbItem.Actors != "N/A" ? omdbItem.Actors : null
                        });
                    }
                }
            }
            catch {}
        }

        // Helper to query OMDB by search keyword
        async Task TryOmdbKeywordSearch(string term)
        {
            try
            {
                var omdbSearchUrl = $"https://www.omdbapi.com/?s={Uri.EscapeDataString(term)}&type=movie&apikey=trilogy";
                var omdbSearch = await _httpClient.GetFromJsonAsync<OmdbSearchResponse>(omdbSearchUrl, ct);

                if (omdbSearch?.Search != null)
                {
                    foreach (var item in omdbSearch.Search)
                    {
                        if (string.IsNullOrWhiteSpace(item.Poster) || item.Poster == "N/A") continue;
                        var id = item.ImdbID ?? item.Title;
                        if (!seenIds.Contains(id))
                        {
                            seenIds.Add(id);
                            results.Add(new PosterSearchResultDto
                            {
                                Title = item.Title,
                                Year = item.Year,
                                ImdbId = item.ImdbID,
                                PosterUrl = item.Poster,
                                Genres = new()
                            });
                        }
                    }
                }
            }
            catch {}
        }

        // 1. First search with clean title
        await TryOmdbTitleSearch(cleanQuery);
        await TryOmdbKeywordSearch(cleanQuery);

        // 2. If no direct results, try first 2-3 words (e.g. "Spider-Man Brand New Day" -> "Spider-Man")
        if (results.Count == 0 && cleanQuery.Contains(' '))
        {
            var parts = cleanQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 1)
            {
                var shorter = string.Join(" ", parts.Take(2));
                await TryOmdbTitleSearch(shorter);
                await TryOmdbKeywordSearch(shorter);
            }
        }

        // 3. Fallback / Supplement via Cinemeta: if candidates found have IMDb ID, resolve through OMDB for direct Amazon CDN
        if (results.Count < 4)
        {
            try
            {
                var cinemetaUrl = $"https://v3-cinemeta.strem.io/catalog/movie/top/search={Uri.EscapeDataString(cleanQuery)}.json";
                var cinemeta = await _httpClient.GetFromJsonAsync<CinemetaCatalogResponse>(cinemetaUrl, ct);

                if (cinemeta?.Metas != null)
                {
                    foreach (var meta in cinemeta.Metas.Take(4))
                    {
                        if (string.IsNullOrWhiteSpace(meta.Id) || seenIds.Contains(meta.Id)) continue;

                        if (meta.Id.StartsWith("tt"))
                        {
                            try
                            {
                                var idLookupUrl = $"https://www.omdbapi.com/?i={meta.Id}&apikey=trilogy";
                                var detail = await _httpClient.GetFromJsonAsync<OmdbDetailResponse>(idLookupUrl, ct);

                                if (detail != null && detail.Response == "True" && !string.IsNullOrWhiteSpace(detail.Poster) && detail.Poster != "N/A")
                                {
                                    seenIds.Add(meta.Id);
                                    double? rating = null;
                                    if (double.TryParse(detail.ImdbRating, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var r))
                                        rating = r;

                                    results.Add(new PosterSearchResultDto
                                    {
                                        Title = detail.Title,
                                        Year = detail.Year,
                                        ImdbId = detail.ImdbID,
                                        PosterUrl = detail.Poster,
                                        Overview = detail.Plot,
                                        Genres = (detail.Genre ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(g => g.Trim()).ToList(),
                                        Rating = rating,
                                        Director = detail.Director != "N/A" ? detail.Director : null,
                                        Cast = detail.Actors != "N/A" ? detail.Actors : null
                                    });
                                }
                            }
                            catch {}
                        }
                    }
                }
            }
            catch {}
        }

        return results;
    }

    public async Task<bool> ImportPosterAsync(Guid mediaItemId, ImportPosterRequestDto request, CancellationToken ct = default)
    {
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
            .FirstOrDefaultAsync(m => m.MediaItemId == mediaItemId || m.Id == mediaItemId, ct);

        if (movie?.MediaItem == null) return false;

        // 1. Download Poster Image
        if (!string.IsNullOrWhiteSpace(request.PosterUrl))
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(8));

                var posterBytes = await _httpClient.GetByteArrayAsync(request.PosterUrl, cts.Token);
                if (posterBytes.Length > 0)
                {
                    var posterFileName = $"poster_{movie.MediaItemId}_{Guid.NewGuid():N}.jpg";
                    var posterPath = Path.Combine(_cacheDirectory, posterFileName);
                    await File.WriteAllBytesAsync(posterPath, posterBytes, ct);

                    var artwork = new Artwork
                    {
                        MediaItemId = movie.MediaItemId,
                        ArtworkType = ArtworkType.Poster,
                        AbsolutePath = posterPath,
                        RelativePath = posterFileName,
                        MimeType = "image/jpeg"
                    };
                    _context.Artworks.Add(artwork);
                    await _context.SaveChangesAsync(ct);

                    movie.MediaItem.PrimaryArtworkId = artwork.Id;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to download poster from URL {Url}", request.PosterUrl);
                return false;
            }
        }

        // 2. Download Backdrop Image if available
        if (!string.IsNullOrWhiteSpace(request.BackdropUrl))
        {
            try
            {
                using var bgCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                bgCts.CancelAfter(TimeSpan.FromSeconds(6));

                var bgBytes = await _httpClient.GetByteArrayAsync(request.BackdropUrl, bgCts.Token);
                if (bgBytes.Length > 0)
                {
                    var bgFileName = $"backdrop_{movie.MediaItemId}_{Guid.NewGuid():N}.jpg";
                    var bgPath = Path.Combine(_cacheDirectory, bgFileName);
                    await File.WriteAllBytesAsync(bgPath, bgBytes, ct);

                    var bgArtwork = new Artwork
                    {
                        MediaItemId = movie.MediaItemId,
                        ArtworkType = ArtworkType.Backdrop,
                        AbsolutePath = bgPath,
                        RelativePath = bgFileName,
                        MimeType = "image/jpeg"
                    };
                    _context.Artworks.Add(bgArtwork);
                    await _context.SaveChangesAsync(ct);

                    movie.MediaItem.BackdropArtworkId = bgArtwork.Id;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to download backdrop from URL {Url}", request.BackdropUrl);
            }
        }

        // 3. Update Title & Metadata if requested
        if (request.UpdateMetadata)
        {
            if (!string.IsNullOrWhiteSpace(request.CleanedTitle))
            {
                movie.MediaItem.Title = request.CleanedTitle;
            }
            if (request.Year.HasValue && request.Year.Value > 1900)
            {
                movie.MediaItem.Year = request.Year.Value;
            }
            if (!string.IsNullOrWhiteSpace(request.Overview))
            {
                movie.MediaItem.Overview = request.Overview;
            }
            if (!string.IsNullOrWhiteSpace(request.Director))
            {
                movie.Director = request.Director;
            }
            if (!string.IsNullOrWhiteSpace(request.Cast))
            {
                movie.Cast = request.Cast;
            }
            if (request.CommunityRating.HasValue && request.CommunityRating.Value > 0)
            {
                movie.MediaItem.CommunityRating = request.CommunityRating.Value;
            }
        }

        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> UploadPosterAsync(Guid mediaItemId, Stream stream, string fileName, CancellationToken ct = default)
    {
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
            .FirstOrDefaultAsync(m => m.MediaItemId == mediaItemId || m.Id == mediaItemId, ct);

        if (movie?.MediaItem == null) return false;

        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var outFileName = $"uploaded_{movie.MediaItemId}_{Guid.NewGuid():N}{ext}";
        var outPath = Path.Combine(_cacheDirectory, outFileName);

        using (var fileStream = File.Create(outPath))
        {
            await stream.CopyToAsync(fileStream, ct);
        }

        var artwork = new Artwork
        {
            MediaItemId = movie.MediaItemId,
            ArtworkType = ArtworkType.Poster,
            AbsolutePath = outPath,
            RelativePath = outFileName,
            MimeType = ext.ToLower() == ".png" ? "image/png" : (ext.ToLower() == ".webp" ? "image/webp" : "image/jpeg")
        };
        _context.Artworks.Add(artwork);
        await _context.SaveChangesAsync(ct);

        movie.MediaItem.PrimaryArtworkId = artwork.Id;
        await _context.SaveChangesAsync(ct);

        return true;
    }

    public async Task<bool> AutoFetchSinglePosterAsync(Guid mediaItemId, CancellationToken ct = default)
    {
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
            .FirstOrDefaultAsync(m => m.MediaItemId == mediaItemId || m.Id == mediaItemId, ct);

        if (movie?.MediaItem == null) return false;

        var clean = CleanTitle(movie.MediaItem.Title);
        var candidates = await SearchPostersAsync(clean, ct);
        if (candidates.Count == 0 && clean != movie.MediaItem.Title)
        {
            candidates = await SearchPostersAsync(movie.MediaItem.Title, ct);
        }

        if (candidates.Count == 0) return false;

        // Try candidates in order until one succeeds
        foreach (var top in candidates.Take(3))
        {
            int? yearInt = null;
            if (int.TryParse(top.Year, out var y)) yearInt = y;

            var ok = await ImportPosterAsync(mediaItemId, new ImportPosterRequestDto
            {
                PosterUrl = top.PosterUrl,
                BackdropUrl = top.BackdropUrl,
                UpdateMetadata = true,
                CleanedTitle = top.Title,
                Year = yearInt,
                Overview = top.Overview,
                Director = top.Director,
                Cast = top.Cast,
                CommunityRating = top.Rating,
                Genres = top.Genres
            }, ct);

            if (ok) return true;
        }

        return false;
    }

    public async Task<bool> AutoFetchDescriptionOnlyAsync(Guid mediaItemId, CancellationToken ct = default)
    {
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
            .FirstOrDefaultAsync(m => m.MediaItemId == mediaItemId || m.Id == mediaItemId, ct);

        if (movie?.MediaItem == null) return false;

        var clean = CleanTitle(movie.MediaItem.Title);
        var candidates = await SearchPostersAsync(clean, ct);
        if (candidates.Count == 0 && clean != movie.MediaItem.Title)
        {
            candidates = await SearchPostersAsync(movie.MediaItem.Title, ct);
        }

        var match = candidates.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.Overview));
        if (match == null) return false;

        movie.MediaItem.Overview = match.Overview;
        if (!string.IsNullOrWhiteSpace(match.Director) && string.IsNullOrWhiteSpace(movie.Director))
            movie.Director = match.Director;
        if (!string.IsNullOrWhiteSpace(match.Cast) && string.IsNullOrWhiteSpace(movie.Cast))
            movie.Cast = match.Cast;
        if (match.Rating.HasValue && (!movie.MediaItem.CommunityRating.HasValue || movie.MediaItem.CommunityRating == 0))
            movie.MediaItem.CommunityRating = match.Rating.Value;

        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<AutoFetchAllResultDto> AutoFetchAllPostersAsync(CancellationToken ct = default)
    {
        var movies = await _context.Movies
            .Include(m => m.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .ToListAsync(ct);

        var result = new AutoFetchAllResultDto
        {
            TotalScanned = movies.Count
        };

        foreach (var movie in movies)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var ok = await AutoFetchSinglePosterAsync(movie.MediaItemId, ct);
                if (ok)
                {
                    result.UpdatedCount++;
                    result.UpdatedTitles.Add(movie.MediaItem?.Title ?? "Movie");
                }
                else
                {
                    result.FailedCount++;
                }

                // Friendly delay between requests
                await Task.Delay(100, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed auto-fetch for movie {Title}", movie.MediaItem?.Title);
                result.FailedCount++;
            }
        }

        return result;
    }

    public async Task<List<PosterSearchResultDto>> SearchTvPostersAsync(string query, CancellationToken ct = default)
    {
        var cleanQuery = CleanTitle(query);
        if (string.IsNullOrWhiteSpace(cleanQuery)) cleanQuery = query.Trim();
        if (string.IsNullOrWhiteSpace(cleanQuery)) return new();

        var results = new List<PosterSearchResultDto>();
        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Helper to query OMDB by series title
        async Task TryOmdbSeriesTitleSearch(string term)
        {
            try
            {
                var omdbTitleUrl = $"https://www.omdbapi.com/?t={Uri.EscapeDataString(term)}&type=series&apikey=trilogy";
                var omdbItem = await _httpClient.GetFromJsonAsync<OmdbDetailResponse>(omdbTitleUrl, ct);

                if (omdbItem != null && omdbItem.Response == "True" && !string.IsNullOrWhiteSpace(omdbItem.Poster) && omdbItem.Poster != "N/A")
                {
                    var id = omdbItem.ImdbID ?? omdbItem.Title;
                    if (!seenIds.Contains(id))
                    {
                        seenIds.Add(id);
                        var genresList = (omdbItem.Genre ?? "")
                            .Split(',', StringSplitOptions.RemoveEmptyEntries)
                            .Select(g => g.Trim())
                            .ToList();

                        double? rating = null;
                        if (double.TryParse(omdbItem.ImdbRating, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var r))
                            rating = r;

                        results.Add(new PosterSearchResultDto
                        {
                            Title = omdbItem.Title,
                            Year = omdbItem.Year,
                            ImdbId = omdbItem.ImdbID,
                            PosterUrl = omdbItem.Poster,
                            Overview = omdbItem.Plot,
                            Genres = genresList,
                            Rating = rating,
                            Director = omdbItem.Director != "N/A" ? omdbItem.Director : null,
                            Cast = omdbItem.Actors != "N/A" ? omdbItem.Actors : null
                        });
                    }
                }
            }
            catch {}
        }

        // Helper to query OMDB by series search
        async Task TryOmdbSeriesKeywordSearch(string term)
        {
            try
            {
                var omdbSearchUrl = $"https://www.omdbapi.com/?s={Uri.EscapeDataString(term)}&type=series&apikey=trilogy";
                var omdbSearch = await _httpClient.GetFromJsonAsync<OmdbSearchResponse>(omdbSearchUrl, ct);

                if (omdbSearch?.Search != null)
                {
                    foreach (var item in omdbSearch.Search)
                    {
                        if (string.IsNullOrWhiteSpace(item.Poster) || item.Poster == "N/A") continue;
                        var id = item.ImdbID ?? item.Title;
                        if (!seenIds.Contains(id))
                        {
                            seenIds.Add(id);
                            results.Add(new PosterSearchResultDto
                            {
                                Title = item.Title,
                                Year = item.Year,
                                ImdbId = item.ImdbID,
                                PosterUrl = item.Poster,
                                Genres = new()
                            });
                        }
                    }
                }
            }
            catch {}
        }

        // 1. Direct clean search
        await TryOmdbSeriesTitleSearch(cleanQuery);
        await TryOmdbSeriesKeywordSearch(cleanQuery);

        // 2. Cinemeta series search with OMDB ID resolution for high-res Amazon CDN URLs
        if (results.Count < 4)
        {
            try
            {
                var cinemetaUrl = $"https://v3-cinemeta.strem.io/catalog/series/top/search={Uri.EscapeDataString(cleanQuery)}.json";
                var cinemeta = await _httpClient.GetFromJsonAsync<CinemetaCatalogResponse>(cinemetaUrl, ct);

                if (cinemeta?.Metas != null)
                {
                    foreach (var meta in cinemeta.Metas.Take(4))
                    {
                        if (string.IsNullOrWhiteSpace(meta.Id) || seenIds.Contains(meta.Id)) continue;

                        if (meta.Id.StartsWith("tt"))
                        {
                            try
                            {
                                var idLookupUrl = $"https://www.omdbapi.com/?i={meta.Id}&apikey=trilogy";
                                var detail = await _httpClient.GetFromJsonAsync<OmdbDetailResponse>(idLookupUrl, ct);

                                if (detail != null && detail.Response == "True" && !string.IsNullOrWhiteSpace(detail.Poster) && detail.Poster != "N/A")
                                {
                                    seenIds.Add(meta.Id);
                                    double? rating = null;
                                    if (double.TryParse(detail.ImdbRating, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var r))
                                        rating = r;

                                    results.Add(new PosterSearchResultDto
                                    {
                                        Title = detail.Title,
                                        Year = detail.Year,
                                        ImdbId = detail.ImdbID,
                                        PosterUrl = detail.Poster,
                                        Overview = detail.Plot,
                                        Genres = (detail.Genre ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Select(g => g.Trim()).ToList(),
                                        Rating = rating,
                                        Director = detail.Director != "N/A" ? detail.Director : null,
                                        Cast = detail.Actors != "N/A" ? detail.Actors : null
                                    });
                                }
                            }
                            catch {}
                        }
                    }
                }
            }
            catch {}
        }

        return results;
    }

    public async Task<bool> ImportTvPosterAsync(Guid showIdOrMediaItemId, ImportPosterRequestDto request, CancellationToken ct = default)
    {
        var show = await _context.TVShows
            .Include(s => s.MediaItem)
            .FirstOrDefaultAsync(s => s.Id == showIdOrMediaItemId || s.MediaItemId == showIdOrMediaItemId, ct);

        if (show?.MediaItem == null) return false;

        // 1. Download Poster
        if (!string.IsNullOrWhiteSpace(request.PosterUrl))
        {
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(8));

                var posterBytes = await _httpClient.GetByteArrayAsync(request.PosterUrl, cts.Token);
                if (posterBytes.Length > 0)
                {
                    var posterFileName = $"tvposter_{show.MediaItemId}_{Guid.NewGuid():N}.jpg";
                    var posterPath = Path.Combine(_cacheDirectory, posterFileName);
                    await File.WriteAllBytesAsync(posterPath, posterBytes, ct);

                    var artwork = new Artwork
                    {
                        MediaItemId = show.MediaItemId,
                        ArtworkType = ArtworkType.Poster,
                        AbsolutePath = posterPath,
                        RelativePath = posterFileName,
                        MimeType = "image/jpeg"
                    };
                    _context.Artworks.Add(artwork);
                    await _context.SaveChangesAsync(ct);

                    show.MediaItem.PrimaryArtworkId = artwork.Id;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to download TV poster from URL {Url}", request.PosterUrl);
                return false;
            }
        }

        // 2. Download Backdrop if provided
        if (!string.IsNullOrWhiteSpace(request.BackdropUrl))
        {
            try
            {
                using var bgCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                bgCts.CancelAfter(TimeSpan.FromSeconds(6));

                var bgBytes = await _httpClient.GetByteArrayAsync(request.BackdropUrl, bgCts.Token);
                if (bgBytes.Length > 0)
                {
                    var bgFileName = $"tvbackdrop_{show.MediaItemId}_{Guid.NewGuid():N}.jpg";
                    var bgPath = Path.Combine(_cacheDirectory, bgFileName);
                    await File.WriteAllBytesAsync(bgPath, bgBytes, ct);

                    var bgArtwork = new Artwork
                    {
                        MediaItemId = show.MediaItemId,
                        ArtworkType = ArtworkType.Backdrop,
                        AbsolutePath = bgPath,
                        RelativePath = bgFileName,
                        MimeType = "image/jpeg"
                    };
                    _context.Artworks.Add(bgArtwork);
                    await _context.SaveChangesAsync(ct);

                    show.MediaItem.BackdropArtworkId = bgArtwork.Id;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to download TV backdrop from URL {Url}", request.BackdropUrl);
            }
        }

        // 3. Update Metadata
        if (request.UpdateMetadata)
        {
            if (!string.IsNullOrWhiteSpace(request.CleanedTitle))
            {
                show.MediaItem.Title = request.CleanedTitle;
            }
            if (request.Year.HasValue && request.Year.Value > 1900)
            {
                show.MediaItem.Year = request.Year.Value;
            }
            if (!string.IsNullOrWhiteSpace(request.Overview))
            {
                show.MediaItem.Overview = request.Overview;
            }
            if (!string.IsNullOrWhiteSpace(request.Cast))
            {
                show.Cast = request.Cast;
            }
            if (request.CommunityRating.HasValue && request.CommunityRating.Value > 0)
            {
                show.MediaItem.CommunityRating = request.CommunityRating.Value;
            }
        }

        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> UploadTvPosterAsync(Guid showIdOrMediaItemId, Stream stream, string fileName, CancellationToken ct = default)
    {
        var show = await _context.TVShows
            .Include(s => s.MediaItem)
            .FirstOrDefaultAsync(s => s.Id == showIdOrMediaItemId || s.MediaItemId == showIdOrMediaItemId, ct);

        if (show?.MediaItem == null) return false;

        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";
        var outFileName = $"tvuploaded_{show.MediaItemId}_{Guid.NewGuid():N}{ext}";
        var outPath = Path.Combine(_cacheDirectory, outFileName);

        using (var fileStream = File.Create(outPath))
        {
            await stream.CopyToAsync(fileStream, ct);
        }

        var artwork = new Artwork
        {
            MediaItemId = show.MediaItemId,
            ArtworkType = ArtworkType.Poster,
            AbsolutePath = outPath,
            RelativePath = outFileName,
            MimeType = ext.ToLower() == ".png" ? "image/png" : (ext.ToLower() == ".webp" ? "image/webp" : "image/jpeg")
        };
        _context.Artworks.Add(artwork);
        await _context.SaveChangesAsync(ct);

        show.MediaItem.PrimaryArtworkId = artwork.Id;
        await _context.SaveChangesAsync(ct);

        return true;
    }

    public async Task<bool> AutoFetchSingleTvPosterAsync(Guid showIdOrMediaItemId, CancellationToken ct = default)
    {
        var show = await _context.TVShows
            .Include(s => s.MediaItem)
            .FirstOrDefaultAsync(s => s.Id == showIdOrMediaItemId || s.MediaItemId == showIdOrMediaItemId, ct);

        if (show?.MediaItem == null) return false;

        var clean = CleanTitle(show.MediaItem.Title);
        var candidates = await SearchTvPostersAsync(clean, ct);
        if (candidates.Count == 0 && clean != show.MediaItem.Title)
        {
            candidates = await SearchTvPostersAsync(show.MediaItem.Title, ct);
        }

        if (candidates.Count == 0) return false;

        foreach (var top in candidates.Take(3))
        {
            int? yearInt = null;
            if (!string.IsNullOrWhiteSpace(top.Year))
            {
                var yStr = top.Year.Split('–', '-')[0].Trim();
                if (int.TryParse(yStr, out var y)) yearInt = y;
            }

            var ok = await ImportTvPosterAsync(show.Id, new ImportPosterRequestDto
            {
                PosterUrl = top.PosterUrl,
                BackdropUrl = top.BackdropUrl,
                UpdateMetadata = true,
                CleanedTitle = top.Title,
                Year = yearInt,
                Overview = top.Overview,
                Director = top.Director,
                Cast = top.Cast,
                CommunityRating = top.Rating,
                Genres = top.Genres
            }, ct);

            if (ok) return true;
        }

        return false;
    }

    public async Task<AutoFetchAllResultDto> AutoFetchAllTvPostersAsync(CancellationToken ct = default)
    {
        var shows = await _context.TVShows
            .Include(s => s.MediaItem)
                .ThenInclude(mi => mi!.PrimaryArtwork)
            .ToListAsync(ct);

        var result = new AutoFetchAllResultDto
        {
            TotalScanned = shows.Count
        };

        foreach (var show in shows)
        {
            if (ct.IsCancellationRequested) break;

            try
            {
                var ok = await AutoFetchSingleTvPosterAsync(show.Id, ct);
                if (ok)
                {
                    result.UpdatedCount++;
                    result.UpdatedTitles.Add(show.MediaItem?.Title ?? "Series");
                }
                else
                {
                    result.FailedCount++;
                }

                await Task.Delay(100, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed auto-fetch for TV show {Title}", show.MediaItem?.Title);
                result.FailedCount++;
            }
        }

        return result;
    }

    // OMDB Models
    private class OmdbDetailResponse
    {
        [JsonPropertyName("Title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("Year")]
        public string? Year { get; set; }

        [JsonPropertyName("Poster")]
        public string? Poster { get; set; }

        [JsonPropertyName("Plot")]
        public string? Plot { get; set; }

        [JsonPropertyName("Genre")]
        public string? Genre { get; set; }

        [JsonPropertyName("imdbRating")]
        public string? ImdbRating { get; set; }

        [JsonPropertyName("Director")]
        public string? Director { get; set; }

        [JsonPropertyName("Actors")]
        public string? Actors { get; set; }

        [JsonPropertyName("imdbID")]
        public string? ImdbID { get; set; }

        [JsonPropertyName("Response")]
        public string? Response { get; set; }
    }

    private class OmdbSearchResponse
    {
        [JsonPropertyName("Search")]
        public List<OmdbSearchItem>? Search { get; set; }

        [JsonPropertyName("Response")]
        public string? Response { get; set; }
    }

    private class OmdbSearchItem
    {
        [JsonPropertyName("Title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("Year")]
        public string? Year { get; set; }

        [JsonPropertyName("imdbID")]
        public string? ImdbID { get; set; }

        [JsonPropertyName("Poster")]
        public string? Poster { get; set; }
    }

    // Cinemeta Models
    private class CinemetaCatalogResponse
    {
        [JsonPropertyName("metas")]
        public List<CinemetaMetaItem>? Metas { get; set; }
    }

    private class CinemetaMetaItem
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("year")]
        public object? Year { get; set; }

        [JsonPropertyName("poster")]
        public string? Poster { get; set; }

        [JsonPropertyName("background")]
        public string? Background { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("genres")]
        public List<string>? Genres { get; set; }
    }
}
