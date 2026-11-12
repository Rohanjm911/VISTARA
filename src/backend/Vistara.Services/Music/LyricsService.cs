using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Services.Music;

public class LyricsService : ILyricsService
{
    private readonly VistaraDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<LyricsService> _logger;

    private const string LrcLibBaseUrl = "https://lrclib.net/api";
    private const string LyricsOvhBaseUrl = "https://api.lyrics.ovh/v1";
    private const string ItunesSearchBaseUrl = "https://itunes.apple.com/search";
    private static readonly ConcurrentDictionary<string, TranslatedLyricsResultDto> _translationCache = new();

    public LyricsService(
        VistaraDbContext context,
        HttpClient httpClient,
        ILogger<LyricsService> _logger)
    {
        _context = context;
        _httpClient = httpClient;
        this._logger = _logger;

        _httpClient.DefaultRequestHeaders.UserAgent.Clear();
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("VISTARA-Media-Universe/1.0 (https://github.com/vistara)");
        _httpClient.Timeout = TimeSpan.FromSeconds(10);
    }

    public async Task<LyricsResultDto> GetLyricsAsync(Guid trackOrMediaItemId, bool forceRefresh = false, CancellationToken ct = default)
    {
        var track = await FindTrackAsync(trackOrMediaItemId, ct);
        if (track == null)
        {
            return new LyricsResultDto
            {
                TrackId = trackOrMediaItemId,
                Source = "not_found"
            };
        }

        // Return existing database lyrics if available and not forcing refresh
        if (!forceRefresh && !string.IsNullOrWhiteSpace(track.Lyrics))
        {
            return new LyricsResultDto
            {
                TrackId = track.Id,
                TrackTitle = track.Title,
                ArtistName = track.Artist?.Name,
                AlbumName = track.Album?.Title,
                DurationSeconds = track.DurationSeconds,
                Lyrics = track.Lyrics,
                IsSynced = IsSyncedLrc(track.Lyrics),
                Source = "embedded"
            };
        }

        // Auto-fetch from LRCLIB
        return await FetchAndSaveLyricsAsync(trackOrMediaItemId, new FetchLyricsRequest { Force = forceRefresh }, ct);
    }

    public async Task<LyricsResultDto> FetchAndSaveLyricsAsync(Guid trackOrMediaItemId, FetchLyricsRequest? request = null, CancellationToken ct = default)
    {
        var track = await FindTrackAsync(trackOrMediaItemId, ct);
        if (track == null)
        {
            return new LyricsResultDto
            {
                TrackId = trackOrMediaItemId,
                Source = "not_found"
            };
        }

        var trackTitle = !string.IsNullOrWhiteSpace(request?.TrackTitle) ? request.TrackTitle.Trim() : track.Title;
        var artistName = !string.IsNullOrWhiteSpace(request?.ArtistName) ? request.ArtistName.Trim() : (track.Artist?.Name ?? string.Empty);
        var albumName = !string.IsNullOrWhiteSpace(request?.AlbumName) ? request.AlbumName.Trim() : (track.Album?.Title ?? string.Empty);

        var (chosenLyrics, source) = await ResolveFromMultipleSourcesAsync(track, trackTitle, artistName, albumName, ct);

        if (!string.IsNullOrWhiteSpace(chosenLyrics))
        {
            track.Lyrics = chosenLyrics;
            await _context.SaveChangesAsync(ct);

            return new LyricsResultDto
            {
                TrackId = track.Id,
                TrackTitle = track.Title,
                ArtistName = track.Artist?.Name,
                AlbumName = track.Album?.Title,
                DurationSeconds = track.DurationSeconds,
                Lyrics = chosenLyrics,
                IsSynced = IsSyncedLrc(chosenLyrics),
                Source = source
            };
        }

        return new LyricsResultDto
        {
            TrackId = track.Id,
            TrackTitle = track.Title,
            ArtistName = track.Artist?.Name,
            AlbumName = track.Album?.Title,
            DurationSeconds = track.DurationSeconds,
            Lyrics = track.Lyrics,
            IsSynced = IsSyncedLrc(track.Lyrics),
            Source = !string.IsNullOrWhiteSpace(track.Lyrics) ? "embedded" : "not_found"
        };
    }

    public async Task<List<LrcLibSearchResultDto>> SearchOnlineLyricsAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query)) return new List<LrcLibSearchResultDto>();

        try
        {
            var url = $"{LrcLibBaseUrl}/search?q={Uri.EscapeDataString(query.Trim())}";
            using var resp = await _httpClient.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return new List<LrcLibSearchResultDto>();

            var items = await resp.Content.ReadFromJsonAsync<List<LrcLibResponse>>(cancellationToken: ct);
            if (items == null) return new List<LrcLibSearchResultDto>();

            return items.Select(i => new LrcLibSearchResultDto
            {
                Id = i.Id,
                TrackName = i.TrackName ?? i.Name ?? "Unknown",
                ArtistName = i.ArtistName ?? "Unknown",
                AlbumName = i.AlbumName,
                Duration = i.Duration,
                Instrumental = i.Instrumental,
                HasSyncedLyrics = !string.IsNullOrWhiteSpace(i.SyncedLyrics),
                SyncedLyrics = i.SyncedLyrics,
                PlainLyrics = i.PlainLyrics
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed searching online lyrics for query '{Query}'", query);
            return new List<LrcLibSearchResultDto>();
        }
    }

    public async Task<LyricsResultDto> ApplyOnlineLyricsAsync(Guid trackOrMediaItemId, int lrclibId, CancellationToken ct = default)
    {
        var track = await FindTrackAsync(trackOrMediaItemId, ct);
        if (track == null)
        {
            return new LyricsResultDto
            {
                TrackId = trackOrMediaItemId,
                Source = "not_found"
            };
        }

        try
        {
            var url = $"{LrcLibBaseUrl}/get/{lrclibId}";
            using var resp = await _httpClient.GetAsync(url, ct);
            if (resp.IsSuccessStatusCode)
            {
                var item = await resp.Content.ReadFromJsonAsync<LrcLibResponse>(cancellationToken: ct);
                if (item != null)
                {
                    var chosen = !string.IsNullOrWhiteSpace(item.SyncedLyrics)
                        ? item.SyncedLyrics
                        : item.PlainLyrics;

                    if (!string.IsNullOrWhiteSpace(chosen))
                    {
                        track.Lyrics = chosen;
                        await _context.SaveChangesAsync(ct);

                        return new LyricsResultDto
                        {
                            TrackId = track.Id,
                            TrackTitle = track.Title,
                            ArtistName = track.Artist?.Name,
                            AlbumName = track.Album?.Title,
                            DurationSeconds = track.DurationSeconds,
                            Lyrics = chosen,
                            IsSynced = IsSyncedLrc(chosen),
                            Source = "lrclib"
                        };
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to apply LRCLIB id {Id} to track {TrackId}", lrclibId, trackOrMediaItemId);
        }

        return new LyricsResultDto
        {
            TrackId = track.Id,
            Lyrics = track.Lyrics,
            IsSynced = IsSyncedLrc(track.Lyrics),
            Source = !string.IsNullOrWhiteSpace(track.Lyrics) ? "embedded" : "not_found"
        };
    }

    private async Task<Track?> FindTrackAsync(Guid trackOrMediaItemId, CancellationToken ct)
    {
        return await _context.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.MediaItem)
            .FirstOrDefaultAsync(t => t.Id == trackOrMediaItemId || t.MediaItemId == trackOrMediaItemId, ct);
    }

    /// <summary>
    /// Resolves lyrics across multiple ordered sources:
    /// 1. Local sidecar .lrc / .txt file next to the audio file
    /// 2. LRCLIB (exact match, artist+title search, multi-query search)
    /// 3. iTunes canonical metadata normalization -> LRCLIB retry
    /// 4. Lyrics.ovh public REST API (raw, primary artist, and iTunes-normalized)
    /// </summary>
    private async Task<(string? Lyrics, string Source)> ResolveFromMultipleSourcesAsync(
        Track track,
        string trackTitle,
        string artistName,
        string albumName,
        CancellationToken ct)
    {
        // 1. Local Sidecar .lrc / .txt file (100% offline, instant)
        var localSidecar = await TryReadLocalSidecarLyricsAsync(track, ct);
        if (!string.IsNullOrWhiteSpace(localSidecar))
        {
            return (localSidecar, "local_lrc");
        }

        var duration = track.DurationSeconds;
        var cleanTitle = CleanTrackTitle(trackTitle);
        var primaryArtist = CleanPrimaryArtist(artistName);

        // 2. LRCLIB (Exact -> Filtered -> Multi-Query)
        var lrclibMatch = await TryFetchFromLrcLibAsync(trackTitle, artistName, albumName, duration, ct)
            ?? (!string.IsNullOrWhiteSpace(primaryArtist) && !string.Equals(primaryArtist, artistName, StringComparison.OrdinalIgnoreCase)
                ? await TryFetchFromLrcLibAsync(cleanTitle, primaryArtist, albumName, duration, ct)
                : null)
            ?? await TrySearchLrcLibMultiQueryAsync(trackTitle, artistName, duration, ct);

        if (lrclibMatch != null)
        {
            var chosen = !string.IsNullOrWhiteSpace(lrclibMatch.SyncedLyrics)
                ? lrclibMatch.SyncedLyrics
                : lrclibMatch.PlainLyrics;
            if (!string.IsNullOrWhiteSpace(chosen))
            {
                return (chosen, "lrclib");
            }
        }

        // 3. iTunes Search Canonical Metadata Normalization + LRCLIB Retry
        var canonical = await TryResolveCanonicalMetadataViaItunesAsync(cleanTitle, primaryArtist, ct);
        if (canonical != null)
        {
            var normMatch = await TryFetchFromLrcLibAsync(canonical.Value.Title, canonical.Value.Artist, string.Empty, duration, ct)
                ?? await TrySearchLrcLibMultiQueryAsync(canonical.Value.Title, canonical.Value.Artist, duration, ct);

            if (normMatch != null)
            {
                var chosen = !string.IsNullOrWhiteSpace(normMatch.SyncedLyrics)
                    ? normMatch.SyncedLyrics
                    : normMatch.PlainLyrics;
                if (!string.IsNullOrWhiteSpace(chosen))
                {
                    return (chosen, "lrclib");
                }
            }
        }

        // 4. Lyrics.ovh Fallback (Primary Artist + Clean Title -> Raw -> iTunes Canonical)
        var ovhCandidates = new List<(string Artist, string Title)>();
        if (!string.IsNullOrWhiteSpace(primaryArtist) && !string.IsNullOrWhiteSpace(cleanTitle))
            ovhCandidates.Add((primaryArtist, cleanTitle));
        if (!string.IsNullOrWhiteSpace(artistName) && !string.IsNullOrWhiteSpace(trackTitle))
            ovhCandidates.Add((artistName, trackTitle));
        if (canonical != null)
            ovhCandidates.Add((CleanPrimaryArtist(canonical.Value.Artist), CleanTrackTitle(canonical.Value.Title)));

        foreach (var (candArtist, candTitle) in ovhCandidates.Distinct())
        {
            var ovhLyrics = await TryFetchFromLyricsOvhAsync(candArtist, candTitle, ct);
            if (!string.IsNullOrWhiteSpace(ovhLyrics))
            {
                return (ovhLyrics, "lyrics.ovh");
            }
        }

        return (null, "not_found");
    }

    private async Task<string?> TryReadLocalSidecarLyricsAsync(Track track, CancellationToken ct)
    {
        var filePath = await _context.MediaFiles
            .Where(f => f.MediaItemId == track.MediaItemId)
            .Select(f => f.AbsolutePath)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(filePath)) return null;

        foreach (var ext in new[] { ".lrc", ".txt" })
        {
            try
            {
                var sidecarPath = Path.ChangeExtension(filePath, ext);
                if (File.Exists(sidecarPath))
                {
                    var content = await File.ReadAllTextAsync(sidecarPath, ct);
                    if (!string.IsNullOrWhiteSpace(content))
                        return content.Trim();
                }
            }
            catch
            {
                // Ignore inaccessible local sidecar files
            }
        }

        return null;
    }

    private async Task<LrcLibResponse?> TryFetchFromLrcLibAsync(
        string trackTitle,
        string artistName,
        string albumName,
        double duration,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(trackTitle)) return null;

        try
        {
            var getUrl = $"{LrcLibBaseUrl}/get?track_name={Uri.EscapeDataString(trackTitle)}&artist_name={Uri.EscapeDataString(artistName)}";
            if (!string.IsNullOrWhiteSpace(albumName))
                getUrl += $"&album_name={Uri.EscapeDataString(albumName)}";
            if (duration > 0)
                getUrl += $"&duration={Math.Round(duration)}";

            using var resp = await _httpClient.GetAsync(getUrl, ct);
            if (resp.IsSuccessStatusCode)
            {
                var exact = await resp.Content.ReadFromJsonAsync<LrcLibResponse>(cancellationToken: ct);
                if (exact != null && (!string.IsNullOrWhiteSpace(exact.SyncedLyrics) || !string.IsNullOrWhiteSpace(exact.PlainLyrics)))
                    return exact;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "LRCLIB exact get failed for '{Title}'", trackTitle);
        }

        try
        {
            var cleanTitle = CleanTrackTitle(trackTitle);
            var searchUrl = $"{LrcLibBaseUrl}/search?track_name={Uri.EscapeDataString(cleanTitle)}";
            if (!string.IsNullOrWhiteSpace(artistName))
                searchUrl += $"&artist_name={Uri.EscapeDataString(artistName)}";

            using var searchResp = await _httpClient.GetAsync(searchUrl, ct);
            if (searchResp.IsSuccessStatusCode)
            {
                var results = await searchResp.Content.ReadFromJsonAsync<List<LrcLibResponse>>(cancellationToken: ct);
                if (results != null && results.Count > 0)
                    return PickBestMatch(results, duration);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "LRCLIB filtered search failed for '{Title}'", trackTitle);
        }

        return null;
    }

    private async Task<LrcLibResponse?> TrySearchLrcLibMultiQueryAsync(
        string rawTitle,
        string? rawArtist,
        double duration,
        CancellationToken ct)
    {
        var queries = GenerateSearchQueries(rawTitle, rawArtist);
        LrcLibResponse? bestPlainMatch = null;

        foreach (var query in queries)
        {
            try
            {
                var searchUrl = $"{LrcLibBaseUrl}/search?q={Uri.EscapeDataString(query)}";
                using var resp = await _httpClient.GetAsync(searchUrl, ct);
                if (!resp.IsSuccessStatusCode) continue;

                var results = await resp.Content.ReadFromJsonAsync<List<LrcLibResponse>>(cancellationToken: ct);
                if (results == null || results.Count == 0) continue;

                var syncedMatch = results
                    .Where(r => !string.IsNullOrWhiteSpace(r.SyncedLyrics))
                    .OrderBy(r => duration > 0 ? Math.Abs(r.Duration - duration) : 0)
                    .FirstOrDefault();

                if (syncedMatch != null)
                    return syncedMatch;

                bestPlainMatch ??= PickBestMatch(results, duration);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "LRCLIB query failed for '{Query}'", query);
            }
        }

        return bestPlainMatch;
    }

    private async Task<(string Title, string Artist)?> TryResolveCanonicalMetadataViaItunesAsync(
        string title,
        string artist,
        CancellationToken ct)
    {
        var term = string.IsNullOrWhiteSpace(artist) ? title : $"{artist} {title}";
        if (string.IsNullOrWhiteSpace(term)) return null;

        try
        {
            var url = $"{ItunesSearchBaseUrl}?term={Uri.EscapeDataString(term.Trim())}&entity=song&limit=1";
            using var resp = await _httpClient.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;

            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("results", out var results) &&
                results.ValueKind == JsonValueKind.Array &&
                results.GetArrayLength() > 0)
            {
                var first = results[0];
                var trackName = first.TryGetProperty("trackName", out var tn) ? tn.GetString() : null;
                var artistName = first.TryGetProperty("artistName", out var an) ? an.GetString() : null;
                if (!string.IsNullOrWhiteSpace(trackName) && !string.IsNullOrWhiteSpace(artistName))
                    return (trackName, artistName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "iTunes metadata lookup failed for '{Term}'", term);
        }

        return null;
    }

    private async Task<string?> TryFetchFromLyricsOvhAsync(string artist, string title, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(artist) || string.IsNullOrWhiteSpace(title)) return null;

        try
        {
            var url = $"{LyricsOvhBaseUrl}/{Uri.EscapeDataString(artist.Trim())}/{Uri.EscapeDataString(title.Trim())}";
            using var resp = await _httpClient.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;

            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("lyrics", out var lyricsProp) &&
                lyricsProp.ValueKind == JsonValueKind.String)
            {
                var text = lyricsProp.GetString()?.Trim();
                if (!string.IsNullOrWhiteSpace(text))
                    return text;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Lyrics.ovh lookup failed for '{Artist} - {Title}'", artist, title);
        }

        return null;
    }

    private static LrcLibResponse? PickBestMatch(List<LrcLibResponse> candidates, double trackDuration)
    {
        // 1. Try finding candidates with SyncedLyrics that match duration within +/- 15 seconds
        if (trackDuration > 0)
        {
            var syncedDurationMatch = candidates
                .Where(c => !string.IsNullOrWhiteSpace(c.SyncedLyrics) && Math.Abs(c.Duration - trackDuration) <= 15)
                .OrderBy(c => Math.Abs(c.Duration - trackDuration))
                .FirstOrDefault();

            if (syncedDurationMatch != null) return syncedDurationMatch;
        }

        // 2. Any synced lyrics
        var anySynced = candidates.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.SyncedLyrics));
        if (anySynced != null) return anySynced;

        // 3. Duration match with plain lyrics
        if (trackDuration > 0)
        {
            var plainDurationMatch = candidates
                .Where(c => !string.IsNullOrWhiteSpace(c.PlainLyrics) && Math.Abs(c.Duration - trackDuration) <= 15)
                .OrderBy(c => Math.Abs(c.Duration - trackDuration))
                .FirstOrDefault();

            if (plainDurationMatch != null) return plainDurationMatch;
        }

        // 4. Any plain lyrics
        return candidates.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c.PlainLyrics));
    }

    public async Task<LyricsResultDto> AutoFetchSyncedLyricsAsync(Guid trackOrMediaItemId, CancellationToken ct = default)
    {
        var track = await FindTrackAsync(trackOrMediaItemId, ct);
        if (track == null)
        {
            return new LyricsResultDto { TrackId = trackOrMediaItemId, Source = "not_found" };
        }

        var (chosenLyrics, source) = await ResolveFromMultipleSourcesAsync(
            track,
            track.Title,
            track.Artist?.Name ?? string.Empty,
            track.Album?.Title ?? string.Empty,
            ct);

        if (!string.IsNullOrWhiteSpace(chosenLyrics))
        {
            track.Lyrics = chosenLyrics;
            await _context.SaveChangesAsync(ct);

            return new LyricsResultDto
            {
                TrackId = track.Id,
                TrackTitle = track.Title,
                ArtistName = track.Artist?.Name,
                AlbumName = track.Album?.Title,
                DurationSeconds = track.DurationSeconds,
                Lyrics = chosenLyrics,
                IsSynced = IsSyncedLrc(chosenLyrics),
                Source = source
            };
        }

        return new LyricsResultDto
        {
            TrackId = track.Id,
            TrackTitle = track.Title,
            ArtistName = track.Artist?.Name,
            AlbumName = track.Album?.Title,
            DurationSeconds = track.DurationSeconds,
            Lyrics = track.Lyrics,
            IsSynced = IsSyncedLrc(track.Lyrics),
            Source = !string.IsNullOrWhiteSpace(track.Lyrics) ? "embedded" : "not_found"
        };
    }

    public async Task<TranslatedLyricsResultDto> TranslateLyricsAsync(TranslateLyricsRequest request, CancellationToken ct = default)
    {
        var targetLang = string.IsNullOrWhiteSpace(request.TargetLanguage) ? "en" : request.TargetLanguage.ToLowerInvariant().Trim();
        var cacheKey = $"{(request.TrackId.HasValue ? request.TrackId.Value.ToString() : "temp")}_{targetLang}_{request.Lyrics?.GetHashCode() ?? 0}";

        if (_translationCache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        var rawLyrics = request.Lyrics;
        if (string.IsNullOrWhiteSpace(rawLyrics) && request.TrackId.HasValue)
        {
            var track = await FindTrackAsync(request.TrackId.Value, ct);
            rawLyrics = track?.Lyrics;
        }

        if (string.IsNullOrWhiteSpace(rawLyrics))
        {
            return new TranslatedLyricsResultDto
            {
                TrackId = request.TrackId,
                TargetLanguage = targetLang,
                Lines = new List<TranslatedLyricLineDto>()
            };
        }

        var result = new TranslatedLyricsResultDto
        {
            TrackId = request.TrackId,
            TargetLanguage = targetLang
        };

        try
        {
            var lines = rawLyrics.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);
            var timestampRegex = new Regex(@"^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)$");
            var parsedList = new List<(double? Time, string Text)>();

            foreach (var l in lines)
            {
                var match = timestampRegex.Match(l);
                if (match.Success)
                {
                    var m = int.Parse(match.Groups[1].Value);
                    var s = int.Parse(match.Groups[2].Value);
                    var ms = match.Groups[3].Success ? int.Parse(match.Groups[3].Value.PadRight(3, '0')[..3]) : 0;
                    parsedList.Add((m * 60 + s + ms / 1000.0, match.Groups[4].Value.Trim()));
                }
                else
                {
                    parsedList.Add((null, l.Trim()));
                }
            }

            var textToTranslate = string.Join("\n", parsedList.Select(p => string.IsNullOrWhiteSpace(p.Text) ? "..." : p.Text));
            var url = $"https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={Uri.EscapeDataString(targetLang)}&dt=t&q={Uri.EscapeDataString(textToTranslate)}";

            using var resp = await _httpClient.GetAsync(url, ct);
            if (resp.IsSuccessStatusCode)
            {
                var jsonStr = await resp.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(jsonStr);
                var root = doc.RootElement;

                var translatedBuilder = new System.Text.StringBuilder();
                if (root.ValueKind == JsonValueKind.Array && root.GetArrayLength() > 0)
                {
                    var chunks = root[0];
                    if (chunks.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var chunk in chunks.EnumerateArray())
                        {
                            if (chunk.ValueKind == JsonValueKind.Array && chunk.GetArrayLength() > 0)
                            {
                                translatedBuilder.Append(chunk[0].GetString());
                            }
                        }
                    }
                }

                if (root.GetArrayLength() > 2 && root[2].ValueKind == JsonValueKind.String)
                {
                    result.SourceLanguage = root[2].GetString() ?? "auto";
                }

                var translatedAll = translatedBuilder.ToString();
                var translatedLines = translatedAll.Split('\n');

                for (int i = 0; i < parsedList.Count; i++)
                {
                    var orig = parsedList[i].Text;
                    var trans = i < translatedLines.Length ? translatedLines[i].Trim() : string.Empty;
                    if (trans == "...") trans = string.Empty;

                    result.Lines.Add(new TranslatedLyricLineDto
                    {
                        Time = parsedList[i].Time,
                        Original = orig,
                        Translated = trans
                    });
                }

                _translationCache[cacheKey] = result;
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lyrics translation failed for target {Lang}", targetLang);
        }

        return result;
    }

    public static List<string> GenerateSearchQueries(string rawTitle, string? rawArtist)
    {
        var queries = new List<string>();
        var cleanTitle = CleanTrackTitle(rawTitle);
        var primaryArtist = CleanPrimaryArtist(rawArtist);

        // 1. Clean Title + Primary Artist
        if (!string.IsNullOrWhiteSpace(cleanTitle) && !string.IsNullOrWhiteSpace(primaryArtist))
        {
            queries.Add($"{cleanTitle} {primaryArtist}");
        }

        // 2. Clean Title Alone (essential for finding synced tracks on LRCLIB!)
        if (!string.IsNullOrWhiteSpace(cleanTitle))
        {
            queries.Add(cleanTitle);
        }

        // 3. Extracted Movie/Album name from title e.g. (From "Andaaz")
        var movieMatch = Regex.Match(rawTitle, @"(?:from|ost|soundtrack)\s+[""']?([^""'\)\]]+)", RegexOptions.IgnoreCase);
        if (movieMatch.Success && !string.IsNullOrWhiteSpace(cleanTitle))
        {
            var movie = movieMatch.Groups[1].Value.Trim().Replace("\"", "").Replace("'", "");
            if (!string.IsNullOrWhiteSpace(movie))
            {
                queries.Add($"{cleanTitle} {movie}");
            }
        }

        // 4. Raw Title + Primary Artist
        if (!string.IsNullOrWhiteSpace(rawTitle) && !string.IsNullOrWhiteSpace(primaryArtist))
        {
            var rawPlusArtist = $"{rawTitle} {primaryArtist}";
            if (!queries.Contains(rawPlusArtist)) queries.Add(rawPlusArtist);
        }

        // 5. Raw Title alone
        if (!string.IsNullOrWhiteSpace(rawTitle) && !queries.Contains(rawTitle))
        {
            queries.Add(rawTitle);
        }

        return queries.Distinct().ToList();
    }

    private static string CleanPrimaryArtist(string? artist)
    {
        if (string.IsNullOrWhiteSpace(artist)) return string.Empty;
        var parts = Regex.Split(artist, @"\s*(?:;|/|&|,\s*(?![a-z0-9])|\bfeat\.?\b|\bft\.?\b)\s*", RegexOptions.IgnoreCase);
        var primary = parts.FirstOrDefault(p => !string.IsNullOrWhiteSpace(p))?.Trim() ?? string.Empty;
        return primary;
    }

    private static string CleanTrackTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        var cleaned = title;
        cleaned = Regex.Replace(cleaned, @"\s*[\(\[](feat\.|ft\.|official|video|audio|remastered|deluxe|bonus|version|from|soundtrack|ost).*?[\)\]]", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\s*-\s*(from|soundtrack|ost|remastered).*$", "", RegexOptions.IgnoreCase);
        cleaned = cleaned.Replace("\"", "").Replace("'", "");
        return cleaned.Trim();
    }

    private static bool IsSyncedLrc(string? lyrics)
    {
        if (string.IsNullOrWhiteSpace(lyrics)) return false;
        return Regex.IsMatch(lyrics, @"\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]");
    }

    private class LrcLibResponse
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("trackName")]
        public string? TrackName { get; set; }

        [JsonPropertyName("artistName")]
        public string? ArtistName { get; set; }

        [JsonPropertyName("albumName")]
        public string? AlbumName { get; set; }

        [JsonPropertyName("duration")]
        public double Duration { get; set; }

        [JsonPropertyName("instrumental")]
        public bool Instrumental { get; set; }

        [JsonPropertyName("plainLyrics")]
        public string? PlainLyrics { get; set; }

        [JsonPropertyName("syncedLyrics")]
        public string? SyncedLyrics { get; set; }
    }
}

