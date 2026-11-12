using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Services.Music;

public interface IMusicArtworkService
{
    Task<AutoFetchAllResultDto> AutoFetchAllAlbumCoversAsync(CancellationToken ct = default);
    Task<bool> AutoFetchSingleAlbumCoverAsync(Guid albumId, CancellationToken ct = default);
}

public class MusicArtworkService : IMusicArtworkService
{
    private readonly VistaraDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly ILogger<MusicArtworkService> _logger;
    private readonly string _cacheDirectory;

    private static readonly int[] ResolutionTiers = { 3000, 1400, 1000, 600 };

    public MusicArtworkService(
        VistaraDbContext context,
        HttpClient httpClient,
        ILogger<MusicArtworkService> logger)
    {
        _context = context;
        _httpClient = httpClient;
        _logger = logger;

        _httpClient.DefaultRequestHeaders.UserAgent.Clear();
        _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) VISTARA/1.2");
        _httpClient.Timeout = TimeSpan.FromSeconds(12);

        _cacheDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "cache", "thumbnails");
        Directory.CreateDirectory(_cacheDirectory);
    }

    public async Task<bool> AutoFetchSingleAlbumCoverAsync(Guid albumId, CancellationToken ct = default)
    {
        var album = await _context.Albums
            .Include(a => a.Artist)
            .Include(a => a.Tracks)
                .ThenInclude(t => t.MediaItem)
            .FirstOrDefaultAsync(a => a.Id == albumId, ct);

        if (album == null) return false;

        var firstTrack = album.Tracks.FirstOrDefault();
        var artwork = await FetchAndSaveHighestResArtworkAsync(
            album.Title,
            album.Artist?.Name,
            firstTrack?.Title,
            ct);

        if (artwork == null) return false;

        _context.Artworks.Add(artwork);
        album.ArtworkId = artwork.Id;

        foreach (var track in album.Tracks)
        {
            if (track.MediaItem != null && track.MediaItem.PrimaryArtworkId == null)
            {
                track.MediaItem.PrimaryArtworkId = artwork.Id;
            }
        }

        if (album.Artist != null && album.Artist.ArtworkId == null)
        {
            album.Artist.ArtworkId = artwork.Id;
        }

        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<AutoFetchAllResultDto> AutoFetchAllAlbumCoversAsync(CancellationToken ct = default)
    {
        var result = new AutoFetchAllResultDto();

        // 1. Fetch missing artwork for Albums
        var albumsWithoutArt = await _context.Albums
            .Include(a => a.Artist)
            .Include(a => a.Tracks)
                .ThenInclude(t => t.MediaItem)
            .Where(a => a.ArtworkId == null)
            .ToListAsync(ct);

        foreach (var album in albumsWithoutArt)
        {
            if (ct.IsCancellationRequested) break;
            result.TotalScanned++;

            var isUnknownAlbum = string.IsNullOrWhiteSpace(album.Title) ||
                album.Title.Equals("Unknown Album", StringComparison.OrdinalIgnoreCase);

            // Skip generic "Unknown Album" as a shared album cover; handle individual tracks below
            if (isUnknownAlbum)
            {
                continue;
            }

            var firstTrack = album.Tracks.FirstOrDefault();
            var artwork = await FetchAndSaveHighestResArtworkAsync(
                album.Title,
                album.Artist?.Name,
                firstTrack?.Title,
                ct);

            if (artwork != null)
            {
                _context.Artworks.Add(artwork);
                album.ArtworkId = artwork.Id;

                foreach (var track in album.Tracks)
                {
                    if (track.MediaItem != null && track.MediaItem.PrimaryArtworkId == null)
                    {
                        track.MediaItem.PrimaryArtworkId = artwork.Id;
                    }
                }

                if (album.Artist != null && album.Artist.ArtworkId == null)
                {
                    album.Artist.ArtworkId = artwork.Id;
                }

                result.UpdatedCount++;
            }
            else
            {
                result.FailedCount++;
            }
        }

        await _context.SaveChangesAsync(ct);

        // 2. Also fetch artwork for any standalone tracks (e.g. singles or "Unknown Album") still missing PrimaryArtworkId
        var tracksWithoutArt = await _context.Tracks
            .Include(t => t.Artist)
            .Include(t => t.Album)
            .Include(t => t.MediaItem)
            .Where(t => t.MediaItem != null && t.MediaItem.PrimaryArtworkId == null)
            .ToListAsync(ct);

        foreach (var track in tracksWithoutArt)
        {
            if (ct.IsCancellationRequested) break;

            // If album now has artwork, inherit it immediately without extra network call
            if (track.Album?.ArtworkId != null && track.MediaItem != null)
            {
                track.MediaItem.PrimaryArtworkId = track.Album.ArtworkId;
                continue;
            }

            result.TotalScanned++;
            var artwork = await FetchAndSaveHighestResArtworkAsync(
                null,
                track.Artist?.Name,
                track.Title,
                ct);

            if (artwork != null && track.MediaItem != null)
            {
                _context.Artworks.Add(artwork);
                track.MediaItem.PrimaryArtworkId = artwork.Id;

                if (track.Artist != null && track.Artist.ArtworkId == null)
                {
                    track.Artist.ArtworkId = artwork.Id;
                }

                result.UpdatedCount++;
            }
            else
            {
                result.FailedCount++;
            }
        }

        await _context.SaveChangesAsync(ct);
        return result;
    }

    private async Task<Artwork?> FetchAndSaveHighestResArtworkAsync(
        string? albumTitle,
        string? artistName,
        string? trackTitle,
        CancellationToken ct)
    {
        var primaryArtist = CleanPrimaryArtist(artistName);
        var cleanAlbum = CleanText(albumTitle);
        var cleanTrack = CleanText(trackTitle);

        string? baseArtworkUrl = null;

        // 1. Try primaryArtist + cleanAlbum as album
        if (!string.IsNullOrWhiteSpace(cleanAlbum) &&
            !cleanAlbum.Equals("Unknown Album", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrWhiteSpace(primaryArtist))
            {
                baseArtworkUrl = await QueryItunesArtworkUrlAsync($"{primaryArtist} {cleanAlbum}", "album", ct);
            }

            // 1b. Fallback to cleanAlbum alone (crucial for soundtracks, compilations, multi-artist OSTs)
            if (string.IsNullOrWhiteSpace(baseArtworkUrl))
            {
                baseArtworkUrl = await QueryItunesArtworkUrlAsync(cleanAlbum, "album", ct);
            }
        }

        // 2. Try primaryArtist + cleanTrack as song
        if (string.IsNullOrWhiteSpace(baseArtworkUrl) && !string.IsNullOrWhiteSpace(cleanTrack))
        {
            if (!string.IsNullOrWhiteSpace(primaryArtist))
            {
                baseArtworkUrl = await QueryItunesArtworkUrlAsync($"{primaryArtist} {cleanTrack}", "song", ct);
            }
        }

        // 3. Final fallback: cleanTrack alone as song
        if (string.IsNullOrWhiteSpace(baseArtworkUrl) && !string.IsNullOrWhiteSpace(cleanTrack))
        {
            baseArtworkUrl = await QueryItunesArtworkUrlAsync(cleanTrack, "song", ct);
        }

        if (string.IsNullOrWhiteSpace(baseArtworkUrl)) return null;

        // Upgrade to highest possible resolution (3000x3000 -> 1400x1400 -> 1000x1000 -> 600x600)
        foreach (var size in ResolutionTiers)
        {
            var hiResUrl = Regex.Replace(baseArtworkUrl, @"/\d+x\d+bb\.(jpg|png|webp)$", $"/{size}x{size}bb.$1", RegexOptions.IgnoreCase);
            var saved = await TryDownloadAndSaveArtworkAsync(hiResUrl, size, ct);
            if (saved != null) return saved;
        }

        return await TryDownloadAndSaveArtworkAsync(baseArtworkUrl, 100, ct);
    }

    private async Task<string?> QueryItunesArtworkUrlAsync(string term, string entity, CancellationToken ct)
    {
        try
        {
            var url = $"https://itunes.apple.com/search?term={Uri.EscapeDataString(term)}&entity={entity}&limit=3";
            using var resp = await _httpClient.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;

            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
            if (doc.RootElement.TryGetProperty("results", out var results) &&
                results.ValueKind == JsonValueKind.Array &&
                results.GetArrayLength() > 0)
            {
                foreach (var item in results.EnumerateArray())
                {
                    if (item.TryGetProperty("artworkUrl100", out var artProp) && artProp.ValueKind == JsonValueKind.String)
                    {
                        var artUrl = artProp.GetString();
                        if (!string.IsNullOrWhiteSpace(artUrl))
                            return artUrl;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "iTunes artwork search failed for '{Term}' ({Entity})", term, entity);
        }

        return null;
    }

    private async Task<Artwork?> TryDownloadAndSaveArtworkAsync(string url, int targetSize, CancellationToken ct)
    {
        try
        {
            using var resp = await _httpClient.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;

            var bytes = await resp.Content.ReadAsByteArrayAsync(ct);
            if (bytes.Length < 1024) return null;

            var contentType = resp.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var ext = contentType.Contains("png", StringComparison.OrdinalIgnoreCase) ? ".png" : ".jpg";
            var fileName = $"album_{Guid.NewGuid():N}{ext}";
            var absPath = Path.Combine(_cacheDirectory, fileName);

            await File.WriteAllBytesAsync(absPath, bytes, ct);

            return new Artwork
            {
                ArtworkType = ArtworkType.Cover,
                RelativePath = fileName,
                AbsolutePath = absPath,
                MimeType = contentType,
                Width = targetSize,
                Height = targetSize
            };
        }
        catch
        {
            return null;
        }
    }

    private static string CleanPrimaryArtist(string? artist)
    {
        if (string.IsNullOrWhiteSpace(artist)) return string.Empty;
        if (artist.Equals("Unknown Artist", StringComparison.OrdinalIgnoreCase)) return string.Empty;
        var parts = Regex.Split(artist, @"\s*(?:;|/|&|,\s*(?![a-z0-9])|\bfeat\.?\b|\bft\.?\b)\s*", RegexOptions.IgnoreCase);
        return parts.FirstOrDefault(p => !string.IsNullOrWhiteSpace(p))?.Trim() ?? string.Empty;
    }

    private static string CleanText(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var cleaned = Regex.Replace(input, @"\s*[\(\[](feat\.|ft\.|official|video|audio|remastered|deluxe|bonus|version|320\s*kbps).*?[\)\]]", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
        return cleaned;
    }
}
