using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.Infrastructure.Security;
using Vistara.MediaEngine;
using Vistara.Services.Metadata;

namespace Vistara.Services.Scanning;

public interface ILibraryScannerService
{
    Task<ScanHistory> ScanLibraryAsync(Guid libraryId, ScanMode mode, IProgress<ScanProgressDto>? progress = null, CancellationToken cancellationToken = default);
    Task<ScanHistory> ScanFolderAsync(Guid folderId, ScanMode mode, IProgress<ScanProgressDto>? progress = null, CancellationToken cancellationToken = default);
}

public class LibraryScannerService : ILibraryScannerService
{
    private readonly VistaraDbContext _context;
    private readonly IFFprobeAnalyzer _analyzer;
    private readonly IThumbnailService _thumbnails;
    private readonly IPathSecurityValidator _security;
    private readonly IMoviePosterService _posterService;
    private readonly ILogger<LibraryScannerService> _logger;

    private static readonly HashSet<string> VideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mkv", ".avi", ".mov", ".webm", ".wmv", ".flv", ".ts", ".m2ts", ".m4v", ".mpg", ".mpeg"
    };

    private static readonly HashSet<string> AudioExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp3", ".flac", ".wav", ".aac", ".m4a", ".alac", ".ogg", ".opus", ".wma", ".aiff",
        ".ape", ".dsf", ".dff", ".mka", ".wv", ".mp2", ".m4b", ".m4p", ".oga", ".mid", ".midi"
    };

    private static readonly HashSet<string> PhotoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff", ".tif", ".heic", ".avif", ".raw", ".cr2", ".nef", ".arw"
    };

    // TV Show episode patterns: S01E02, S01 E02, 1x02, Season 1 Episode 2, multi-episode S02E01+E02
    public static readonly Regex TvFilenameRegex1 = new(
        @"^(?<show>.*?)[.\s_-]+(?:s|season\s*)(?<season>\d{1,2})[.\s_-]*(?:e|ep|episode\s*|\+)*(?<episode>\d{1,3})(?:[+eE-]\d{1,3})?(?<rest>.*)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static readonly Regex TvFilenameRegex2 = new(
        @"^(?<show>.*?)[.\s_-]+(?<season>\d{1,2})x(?<episode>\d{1,3})(?<rest>.*)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static readonly Regex FolderSeasonRegex = new(
        @"(?:season|series|s)[\s._-]*(\d{1,2})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static readonly Regex EpisodeOnlyRegex = new(
        @"(?:episode|ep|e)[\s._-]*(\d{1,3})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static readonly Regex ReleaseNoiseRegex = new(
        @"\b(?:1080p|720p|2160p|4k|480p|uhd|fhd|hd|hq|dsnp|web-?dl|webrip|web-?hd|hdtv|bluray|bdrip|brrip|dvdrip|x264|x265|hevc|h264|h265|10bit|aac|dts|ddp?5\.1|ddp?|dd\+|6ch|ac3|mp3|remux|proper|repack|complete|zip|hindi|english|telugu|tamil|malayalam|kannada|tel|tam|hin|mal|eng|multi|dual|audio|esubs?|msubs?|sub|subs|minx|vegamovies|vegamovies\.(?:nl|is|to|org))\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Legacy regex for TV episode patterns
    private static readonly Regex SeasonEpisodeRegex = TvFilenameRegex1;

    // Regex for year extraction: (2023), [2022], .2021.
    private static readonly Regex YearRegex = new(
        @"(?:\(|\.|\[|\s)(19\d{2}|20\d{2})(?:\)|\.|\]|\s)",
        RegexOptions.Compiled);

    // Regex for edition identification: Director's Cut, Extended, Theatrical, Remastered, 4K, 1080p
    private static readonly Regex EditionRegex = new(
        @"(director'?s[\s\.]*cut|extended(?:[\s\.]*cut)?|theatrical(?:[\s\.]*version)?|unrated|remastered|special[\s\.]*edition|imax)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ResolutionRegex = new(
        @"(2160p|4k|1080p|720p|480p|uhd|fhd|hd)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public LibraryScannerService(
        VistaraDbContext context,
        IFFprobeAnalyzer analyzer,
        IThumbnailService thumbnails,
        IPathSecurityValidator security,
        IMoviePosterService posterService,
        ILogger<LibraryScannerService> logger)
    {
        _context = context;
        _analyzer = analyzer;
        _thumbnails = thumbnails;
        _security = security;
        _posterService = posterService;
        _logger = logger;
    }

    public async Task<ScanHistory> ScanLibraryAsync(Guid libraryId, ScanMode mode, IProgress<ScanProgressDto>? progress = null, CancellationToken cancellationToken = default)
    {
        progress?.Report(new ScanProgressDto
        {
            LibraryId = libraryId,
            Status = "Starting scan...",
            CurrentFile = "Discovering media files...",
            Percentage = 0
        });

        var library = await _context.Libraries
            .Include(l => l.Folders)
            .FirstOrDefaultAsync(l => l.Id == libraryId, cancellationToken);

        if (library == null)
            throw new ArgumentException($"Library with id '{libraryId}' not found.");

        var scanHistory = new ScanHistory
        {
            LibraryId = libraryId,
            ScanMode = mode,
            StartTimeUtc = DateTime.UtcNow,
            Status = JobStatus.Running
        };
        _context.ScanHistories.Add(scanHistory);
        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            foreach (var folder in library.Folders)
            {
                if (cancellationToken.IsCancellationRequested) break;
                await ScanFolderInternalAsync(library, folder, scanHistory, progress, cancellationToken);
            }

            scanHistory.Status = JobStatus.Completed;
            scanHistory.EndTimeUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            progress?.Report(new ScanProgressDto
            {
                LibraryId = libraryId,
                Status = "Completed",
                CurrentFile = "Scan completed",
                Percentage = 100,
                FilesProcessed = scanHistory.FilesProcessed,
                FilesDiscovered = scanHistory.FilesDiscovered
            });

            return scanHistory;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scan failed for library {LibraryId}", libraryId);
            scanHistory.Status = JobStatus.Failed;
            scanHistory.ErrorMessage = ex.Message;
            scanHistory.EndTimeUtc = DateTime.UtcNow;
            try { await _context.SaveChangesAsync(CancellationToken.None); } catch { }

            progress?.Report(new ScanProgressDto
            {
                LibraryId = libraryId,
                Status = "Failed",
                CurrentFile = "Scan failed",
                Percentage = 0,
                ErrorMessage = ex.Message
            });

            throw;
        }
    }

    public async Task<ScanHistory> ScanFolderAsync(Guid folderId, ScanMode mode, IProgress<ScanProgressDto>? progress = null, CancellationToken cancellationToken = default)
    {
        var folder = await _context.LibraryFolders
            .Include(f => f.Library)
            .FirstOrDefaultAsync(f => f.Id == folderId, cancellationToken);

        if (folder == null || folder.Library == null)
            throw new ArgumentException($"Folder with id '{folderId}' not found.");

        progress?.Report(new ScanProgressDto
        {
            LibraryId = folder.LibraryId,
            FolderId = folderId,
            Status = "Starting scan...",
            CurrentFile = "Discovering files...",
            Percentage = 0
        });

        var scanHistory = new ScanHistory
        {
            LibraryId = folder.LibraryId,
            LibraryFolderId = folderId,
            ScanMode = mode,
            StartTimeUtc = DateTime.UtcNow,
            Status = JobStatus.Running
        };
        _context.ScanHistories.Add(scanHistory);
        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            await ScanFolderInternalAsync(folder.Library, folder, scanHistory, progress, cancellationToken);
            scanHistory.Status = JobStatus.Completed;
            scanHistory.EndTimeUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            progress?.Report(new ScanProgressDto
            {
                LibraryId = folder.LibraryId,
                FolderId = folderId,
                Status = "Completed",
                CurrentFile = "Scan completed",
                Percentage = 100,
                FilesProcessed = scanHistory.FilesProcessed,
                FilesDiscovered = scanHistory.FilesDiscovered
            });

            return scanHistory;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scan failed for folder {FolderId}", folderId);
            scanHistory.Status = JobStatus.Failed;
            scanHistory.ErrorMessage = ex.Message;
            scanHistory.EndTimeUtc = DateTime.UtcNow;
            try { await _context.SaveChangesAsync(CancellationToken.None); } catch { }

            progress?.Report(new ScanProgressDto
            {
                LibraryId = folder.LibraryId,
                FolderId = folderId,
                Status = "Failed",
                CurrentFile = "Scan failed",
                Percentage = 0,
                ErrorMessage = ex.Message
            });

            throw;
        }
    }

    private async Task ScanFolderInternalAsync(
        Library library,
        LibraryFolder folder,
        ScanHistory scanHistory,
        IProgress<ScanProgressDto>? progress,
        CancellationToken cancellationToken)
    {
        if (!Directory.Exists(folder.Path))
        {
            folder.IsAccessible = false;
            await _context.SaveChangesAsync(cancellationToken);
            return;
        }

        folder.IsAccessible = true;
        folder.LastScannedUtc = DateTime.UtcNow;

        var supportedExtensions = library.Type switch
        {
            LibraryType.Movies or LibraryType.TVShows => VideoExtensions,
            LibraryType.Music => AudioExtensions,
            LibraryType.Photos => PhotoExtensions,
            _ => VideoExtensions.Union(AudioExtensions).Union(PhotoExtensions).ToHashSet(StringComparer.OrdinalIgnoreCase)
        };

        // Enumerate files safely
        var fileList = new List<string>();
        try
        {
            var options = new EnumerationOptions
            {
                RecurseSubdirectories = true,
                IgnoreInaccessible = true,
                AttributesToSkip = FileAttributes.ReparsePoint
            };
            var allFiles = Directory.EnumerateFiles(folder.Path, "*.*", options);
            foreach (var f in allFiles)
            {
                var ext = Path.GetExtension(f);
                if (supportedExtensions.Contains(ext))
                {
                    fileList.Add(f);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading directory '{FolderPath}'", folder.Path);
            scanHistory.ErrorMessage = $"Error reading directory '{folder.Path}': {ex.Message}";
            return;
        }

        scanHistory.FilesDiscovered += fileList.Count;
        var existingFiles = await _context.MediaFiles
            .Where(f => f.LibraryFolderId == folder.Id)
            .ToDictionaryAsync(f => f.AbsolutePath, StringComparer.OrdinalIgnoreCase, cancellationToken);

        int processed = 0;
        foreach (var filePath in fileList)
        {
            if (cancellationToken.IsCancellationRequested) break;

            processed++;
            var dto = new ScanProgressDto
            {
                LibraryId = library.Id,
                FolderId = folder.Id,
                FilesDiscovered = fileList.Count,
                FilesProcessed = processed,
                CurrentFile = Path.GetFileName(filePath),
                Percentage = Math.Round((double)processed / fileList.Count * 100, 1),
                Status = "Processing"
            };
            progress?.Report(dto);

            try
            {
                var fileInfo = new FileInfo(filePath);
                if (existingFiles.TryGetValue(filePath, out var existingFile))
                {
                    // Check if file was modified
                    if (existingFile.FileSizeBytes == fileInfo.Length && !existingFile.IsMissing)
                    {
                        continue; // No change
                    }

                    if (existingFile.IsMissing)
                    {
                        existingFile.IsMissing = false;
                        existingFile.MissingSinceUtc = null;
                        scanHistory.FilesUpdated++;
                    }
                }

                // Process new or modified file
                await ProcessMediaFileAsync(library, folder, filePath, fileInfo, existingFile, cancellationToken);
                scanHistory.FilesProcessed++;
            }
            catch (Exception ex)
            {
                // Continue scanning even if one file fails, but log error
                _logger.LogError(ex, "Failed processing '{FilePath}': {Message}", filePath, ex.Message);
                scanHistory.ErrorMessage = $"Failed processing '{Path.GetFileName(filePath)}': {ex.Message}";
            }
        }

        // Check for missing files (files in DB that are no longer on disk)
        var currentSet = new HashSet<string>(fileList, StringComparer.OrdinalIgnoreCase);
        foreach (var (path, mediaFile) in existingFiles)
        {
            if (!currentSet.Contains(path) && !mediaFile.IsMissing)
            {
                mediaFile.IsMissing = true;
                mediaFile.MissingSinceUtc = DateTime.UtcNow;
                scanHistory.FilesMissing++;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task ProcessMediaFileAsync(
        Library library,
        LibraryFolder folder,
        string filePath,
        FileInfo fileInfo,
        MediaFile? existingFile,
        CancellationToken cancellationToken)
    {
        var probe = await _analyzer.ProbeFileAsync(filePath, cancellationToken);

        // Calculate quick hash
        string? hash = null;
        try
        {
            hash = ComputeQuickFileHash(filePath);
        }
        catch { }

        var mediaFile = existingFile ?? new MediaFile
        {
            LibraryFolderId = folder.Id,
            AbsolutePath = filePath,
            RelativePath = Path.GetRelativePath(folder.Path, filePath),
        };

        mediaFile.FileSizeBytes = fileInfo.Length;
        mediaFile.FileHashSha256 = hash;
        mediaFile.ContainerFormat = probe.ContainerFormat;
        mediaFile.DurationSeconds = probe.DurationSeconds;
        mediaFile.BitrateKbps = probe.BitrateKbps;
        mediaFile.VideoCodec = probe.VideoCodec;
        mediaFile.AudioCodec = probe.AudioCodec;
        mediaFile.ResolutionWidth = probe.Width;
        mediaFile.ResolutionHeight = probe.Height;
        mediaFile.FrameRate = probe.FrameRate;
        mediaFile.IsMissing = false;
        mediaFile.MissingSinceUtc = null;

        // Parse editions and resolutions
        var fileName = Path.GetFileNameWithoutExtension(filePath);
        var editionMatch = EditionRegex.Match(fileName);
        if (editionMatch.Success)
            mediaFile.EditionName = editionMatch.Value;

        var resMatch = ResolutionRegex.Match(fileName);
        string? resLabel = resMatch.Success ? resMatch.Value.ToUpperInvariant() : null;
        if (string.IsNullOrEmpty(resLabel) && probe.Height.HasValue)
        {
            resLabel = probe.Height >= 2160 ? "4K UHD" : (probe.Height >= 1080 ? "1080p" : (probe.Height >= 720 ? "720p" : "SD"));
        }

        if (library.Type == LibraryType.Movies)
        {
            await ProcessMovieFileAsync(library, mediaFile, fileName, probe, resLabel, cancellationToken);
        }
        else if (library.Type == LibraryType.TVShows)
        {
            await ProcessTVShowFileAsync(library, mediaFile, fileName, filePath, probe, cancellationToken);
        }
        else if (library.Type == LibraryType.Music)
        {
            await ProcessMusicFileAsync(library, mediaFile, fileName, probe, cancellationToken);
        }
        else if (library.Type == LibraryType.Photos)
        {
            await ProcessPhotoFileAsync(library, mediaFile, fileName, probe, cancellationToken);
        }

        // Add streams
        if (existingFile != null)
        {
            var oldStreams = await _context.MediaStreams.Where(s => s.MediaFileId == existingFile.Id).ToListAsync(cancellationToken);
            if (oldStreams.Count > 0)
            {
                _context.MediaStreams.RemoveRange(oldStreams);
            }
        }

        mediaFile.Streams.Clear();
        foreach (var stream in probe.Streams)
        {
            stream.Id = Guid.NewGuid();
            stream.MediaFileId = mediaFile.Id;
            stream.MediaFile = mediaFile;
            mediaFile.Streams.Add(stream);
        }

        if (existingFile == null)
        {
            _context.MediaFiles.Add(mediaFile);
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Safely generate artwork after MediaItem and MediaFile are persisted (avoids EF Core circular FK cycle)
        await GenerateArtworkIfMissingAsync(mediaFile, probe, library.Type, cancellationToken);

        // Update FTS search index
        await UpdateSearchIndexAsync(mediaFile.MediaItemId, cancellationToken);
    }

    private async Task ProcessMovieFileAsync(
        Library library,
        MediaFile mediaFile,
        string fileName,
        MediaProbeResult probe,
        string? resLabel,
        CancellationToken cancellationToken)
    {
        // Extract clean movie title and year
        var (title, year) = ParseTitleAndYear(fileName);

        // Check if movie already exists in this library with same title and year (multiple editions support!)
        var movie = await _context.Movies
            .Include(m => m.MediaItem)
            .Include(m => m.Editions)
            .FirstOrDefaultAsync(m => m.MediaItem!.LibraryId == library.Id &&
                                      m.MediaItem.Title.ToLower() == title.ToLower() &&
                                      m.MediaItem.Year == year, cancellationToken);

        if (movie == null)
        {
            var mediaItem = new MediaItem
            {
                LibraryId = library.Id,
                Type = MediaType.Movie,
                Title = title,
                SortTitle = title,
                Year = year,
                RuntimeMinutes = (int)Math.Round(probe.DurationSeconds / 60)
            };
            _context.MediaItems.Add(mediaItem);

            movie = new Movie
            {
                MediaItem = mediaItem
            };
            _context.Movies.Add(movie);
            mediaFile.MediaItem = mediaItem;
        }
        else
        {
            mediaFile.MediaItemId = movie.MediaItemId;
        }

        // Create or update MovieEdition
        var edition = movie.Editions.FirstOrDefault(e => e.MediaFileId == mediaFile.Id) ?? new MovieEdition
        {
            Movie = movie,
            MediaFile = mediaFile,
            EditionName = mediaFile.EditionName ?? "Theatrical",
            ResolutionLabel = resLabel
        };

        if (!movie.Editions.Any(e => e.EditionName == edition.EditionName && e.MediaFileId == edition.MediaFileId))
        {
            movie.Editions.Add(edition);
            _context.MovieEditions.Add(edition);
        }
    }

    private async Task ProcessTVShowFileAsync(
        Library library,
        MediaFile mediaFile,
        string fileName,
        string filePath,
        MediaProbeResult probe,
        CancellationToken cancellationToken)
    {
        var (cleanShowTitle, seasonNum, episodeNum, cleanEpTitle, showYear) = ParseTVShowDetails(fileName, filePath);

        // Find or create TVShow (check local tracker first, then database)
        var tvShow = _context.TVShows.Local
            .FirstOrDefault(s => s.MediaItem != null &&
                                 s.MediaItem.LibraryId == library.Id &&
                                 string.Equals(s.MediaItem.Title, cleanShowTitle, StringComparison.OrdinalIgnoreCase));

        if (tvShow == null)
        {
            tvShow = await _context.TVShows
                .Include(s => s.MediaItem)
                .Include(s => s.Seasons)
                    .ThenInclude(se => se.Episodes)
                .FirstOrDefaultAsync(s => s.MediaItem!.LibraryId == library.Id &&
                                          s.MediaItem.Title.ToLower() == cleanShowTitle.ToLower(), cancellationToken);
        }

        if (tvShow == null)
        {
            var showItem = new MediaItem
            {
                LibraryId = library.Id,
                Type = MediaType.Custom,
                Title = cleanShowTitle,
                SortTitle = cleanShowTitle,
                Year = showYear
            };
            _context.MediaItems.Add(showItem);

            tvShow = new TVShow
            {
                MediaItem = showItem
            };
            _context.TVShows.Add(tvShow);
        }

        // Find or create Season
        var season = tvShow.Seasons.FirstOrDefault(s => s.SeasonNumber == seasonNum)
                     ?? _context.Seasons.Local.FirstOrDefault(s => (s.TVShow == tvShow || (tvShow.Id != Guid.Empty && s.TVShowId == tvShow.Id)) && s.SeasonNumber == seasonNum);

        if (season == null)
        {
            season = new Season
            {
                TVShow = tvShow,
                SeasonNumber = seasonNum,
                Title = $"Season {seasonNum}"
            };
            tvShow.Seasons.Add(season);
            _context.Seasons.Add(season);
        }

        // Find or create Episode
        var episode = season.Episodes.FirstOrDefault(e => e.EpisodeNumber == episodeNum)
                      ?? _context.Episodes.Local.FirstOrDefault(e => (e.Season == season || (season.Id != Guid.Empty && e.SeasonId == season.Id)) && e.EpisodeNumber == episodeNum);

        if (episode == null)
        {
            var epItem = new MediaItem
            {
                LibraryId = library.Id,
                Type = MediaType.Episode,
                Title = cleanEpTitle,
                SortTitle = cleanEpTitle,
                RuntimeMinutes = (int)Math.Round(probe.DurationSeconds / 60)
            };
            _context.MediaItems.Add(epItem);

            episode = new Episode
            {
                Season = season,
                MediaItem = epItem,
                EpisodeNumber = episodeNum,
                Title = cleanEpTitle
            };
            season.Episodes.Add(episode);
            _context.Episodes.Add(episode);
            mediaFile.MediaItem = epItem;
        }
        else
        {
            mediaFile.MediaItemId = episode.MediaItemId;
        }
    }

    private async Task ProcessMusicFileAsync(
        Library library,
        MediaFile mediaFile,
        string fileName,
        MediaProbeResult probe,
        CancellationToken cancellationToken)
    {
        // Extract tags from ID3 / metadata
        probe.Tags.TryGetValue("title", out var title);
        if (string.IsNullOrWhiteSpace(title)) title = fileName;

        probe.Tags.TryGetValue("artist", out var artistName);
        if (string.IsNullOrWhiteSpace(artistName))
            artistName = Directory.GetParent(mediaFile.AbsolutePath)?.Parent?.Name ?? "Unknown Artist";

        probe.Tags.TryGetValue("album", out var albumTitle);
        if (string.IsNullOrWhiteSpace(albumTitle))
            albumTitle = Directory.GetParent(mediaFile.AbsolutePath)?.Name ?? "Unknown Album";

        probe.Tags.TryGetValue("genre", out var genre);
        probe.Tags.TryGetValue("lyrics", out var lyrics);

        int? trackNum = null;
        if (probe.Tags.TryGetValue("track", out var trStr))
        {
            var p = trStr.Split('/')[0];
            if (int.TryParse(p, out var t)) trackNum = t;
        }

        int? year = null;
        if (probe.Tags.TryGetValue("date", out var dStr) || probe.Tags.TryGetValue("year", out dStr))
        {
            if (YearRegex.Match(dStr) is { Success: true } ym && int.TryParse(ym.Groups[1].Value, out var y))
                year = y;
        }

        // Find or create Artist (check local tracker first, then database)
        var artist = _context.Artists.Local
            .FirstOrDefault(a => string.Equals(a.Name, artistName, StringComparison.OrdinalIgnoreCase));
        if (artist == null)
        {
            artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Name.ToLower() == artistName.ToLower(), cancellationToken);
        }
        if (artist == null)
        {
            artist = new Artist { Name = artistName };
            _context.Artists.Add(artist);
        }

        // Find or create Album (check local tracker first, then database)
        var album = _context.Albums.Local
            .FirstOrDefault(al => (al.Artist == artist || (artist.Id != Guid.Empty && al.ArtistId == artist.Id)) &&
                                  string.Equals(al.Title, albumTitle, StringComparison.OrdinalIgnoreCase));
        if (album == null)
        {
            album = await _context.Albums
                .FirstOrDefaultAsync(al => (al.Artist == artist || (artist.Id != Guid.Empty && al.ArtistId == artist.Id) || (al.Artist != null && al.Artist.Name.ToLower() == artistName.ToLower())) &&
                                           al.Title.ToLower() == albumTitle.ToLower(), cancellationToken);
        }
        if (album == null)
        {
            album = new Album
            {
                Artist = artist,
                Title = albumTitle,
                ReleaseYear = year,
                Genre = genre
            };
            _context.Albums.Add(album);
        }

        // Create MediaItem & Track
        var trackItem = new MediaItem
        {
            LibraryId = library.Id,
            Type = MediaType.Track,
            Title = title,
            SortTitle = title,
            Year = year,
            RuntimeMinutes = (int)Math.Round(probe.DurationSeconds / 60)
        };
        _context.MediaItems.Add(trackItem);

        var track = new Track
        {
            MediaItem = trackItem,
            Album = album,
            Artist = artist,
            Title = title,
            TrackNumber = trackNum,
            DurationSeconds = probe.DurationSeconds,
            Year = year,
            Genre = genre,
            Lyrics = lyrics
        };
        _context.Tracks.Add(track);
        mediaFile.MediaItem = trackItem;
    }

    private async Task ProcessPhotoFileAsync(
        Library library,
        MediaFile mediaFile,
        string fileName,
        MediaProbeResult probe,
        CancellationToken cancellationToken)
    {
        var photoItem = new MediaItem
        {
            LibraryId = library.Id,
            Type = MediaType.Photo,
            Title = fileName,
            SortTitle = fileName
        };
        _context.MediaItems.Add(photoItem);

        var photo = new Photo
        {
            MediaItem = photoItem,
            Width = probe.Width ?? 1920,
            Height = probe.Height ?? 1080
        };

        if (probe.Exif != null)
        {
            photo.DateTakenUtc = probe.Exif.DateTakenUtc;
            photo.CameraMake = probe.Exif.CameraMake;
            photo.CameraModel = probe.Exif.CameraModel;
            photo.LensModel = probe.Exif.LensModel;
            photo.FocalLengthMm = probe.Exif.FocalLengthMm;
            photo.ApertureFNumber = probe.Exif.ApertureFNumber;
            photo.ShutterSpeed = probe.Exif.ShutterSpeed;
            photo.IsoSpeed = probe.Exif.IsoSpeed;
            photo.Orientation = probe.Exif.Orientation;
        }

        _context.Photos.Add(photo);
        mediaFile.MediaItem = photoItem;
    }

    public static (string ShowTitle, int SeasonNumber, int EpisodeNumber, string EpisodeTitle, int? Year) ParseTVShowDetails(string fileName, string filePath)
    {
        int seasonNum = 1;
        int episodeNum = 1;
        string rawShow = string.Empty;
        string rest = string.Empty;

        var m1 = TvFilenameRegex1.Match(fileName);
        var m2 = !m1.Success ? TvFilenameRegex2.Match(fileName) : null;

        if (m1.Success || (m2 != null && m2.Success))
        {
            var m = m1.Success ? m1 : m2!;
            if (int.TryParse(m.Groups["season"].Value, out var s)) seasonNum = s;
            if (int.TryParse(m.Groups["episode"].Value, out var e)) episodeNum = e;
            rawShow = m.Groups["show"].Value;
            rest = m.Groups["rest"].Value;
        }
        else
        {
            var epMatch = EpisodeOnlyRegex.Match(fileName);
            if (epMatch.Success && int.TryParse(epMatch.Groups[1].Value, out var e))
                episodeNum = e;

            var parentName = Directory.GetParent(filePath)?.Name ?? string.Empty;
            var fMatch = FolderSeasonRegex.Match(parentName);
            if (fMatch.Success && int.TryParse(fMatch.Groups[1].Value, out var s))
                seasonNum = s;
        }

        // Clean raw show title or fallback to folder hierarchy
        string showTitle = CleanShowTitle(rawShow);
        if (string.IsNullOrWhiteSpace(showTitle) || showTitle.Length < 2)
        {
            var parentDir = Directory.GetParent(filePath)?.Name ?? "TV Show";
            if (FolderSeasonRegex.IsMatch(parentDir))
            {
                showTitle = CleanShowTitle(Directory.GetParent(filePath)?.Parent?.Name ?? parentDir);
            }
            else
            {
                showTitle = CleanShowTitle(parentDir);
            }
        }

        // Year extraction from show title or filename
        var (cleanShowTitle, showYear) = ParseTitleAndYear(showTitle);
        cleanShowTitle = NormalizeShowTitle(cleanShowTitle);

        // Episode title cleaning
        string cleanEpTitle = CleanEpisodeTitle(rest, episodeNum, cleanShowTitle);

        return (cleanShowTitle, seasonNum, episodeNum, cleanEpTitle, showYear);
    }

    private static string CleanShowTitle(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        var s = Regex.Replace(raw, @"\[.*?\]", "");
        s = Regex.Replace(s, @"\(.*?\)", "");
        s = ReleaseNoiseRegex.Replace(s, "");
        s = s.Replace('.', ' ').Replace('_', ' ');
        s = Regex.Replace(s, @"\s+", " ").Trim(' ', '-', '.', '_');
        return s;
    }

    private static string NormalizeShowTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title)) return "TV Show";
        var lower = title.Trim().ToLowerInvariant();
        if (lower == "mr robot" || lower == "mr. robot" || lower == "mr.robot")
            return "Mr. Robot";
        if (lower == "dexter new blood")
            return "Dexter: New Blood";
        if (lower == "dexter original sin")
            return "Dexter: Original Sin";
        if (lower == "dexter")
            return "Dexter";
        if (lower == "loki")
            return "Loki";
        if (lower == "moon knight")
            return "Moon Knight";

        return title.Trim();
    }

    private static string CleanEpisodeTitle(string rest, int epNum, string showTitle)
    {
        if (string.IsNullOrWhiteSpace(rest)) return $"Episode {epNum}";

        var t = Regex.Replace(rest, @"^[._\s+-]*(?:e|ep|episode|\+)*\s*\d{1,3}[._\s+-]*", " ", RegexOptions.IgnoreCase);
        if (!string.IsNullOrWhiteSpace(showTitle) && t.Trim().StartsWith(showTitle, StringComparison.OrdinalIgnoreCase))
        {
            t = t.Trim().Substring(showTitle.Length);
        }
        t = Regex.Replace(t, @"(?:vegamovies|vegamovier|vega)\s*[\.-]?\s*(?:nl|is|to|com|org|net)?", "", RegexOptions.IgnoreCase);
        t = ReleaseNoiseRegex.Replace(t, "");
        t = Regex.Replace(t, @"\[.*?\]", "");
        t = Regex.Replace(t, @"\(.*?\)", "");
        t = Regex.Replace(t, @"\b\d\s*1\b", ""); // Strip lingering 5 1 audio channel fragments
        t = t.Replace('.', ' ').Replace('_', ' ');
        t = Regex.Replace(t, @"\s+", " ").Trim(' ', '-', '.', '_', '+');

        if (string.IsNullOrWhiteSpace(t) || t.Length <= 1 || Regex.IsMatch(t, @"^(?:nl|is|to|com|net|org)$", RegexOptions.IgnoreCase) || string.Equals(t, $"Episode {epNum}", StringComparison.OrdinalIgnoreCase))
        {
            return $"Episode {epNum}";
        }

        return t;
    }

    private static (string Title, int? Year) ParseTitleAndYear(string input)
    {
        int? year = null;
        var yearMatch = YearRegex.Match(input);
        string clean = input;

        if (yearMatch.Success && int.TryParse(yearMatch.Groups[1].Value, out var y))
        {
            year = y;
            clean = input.Substring(0, yearMatch.Index);
        }

        // Clean up separators like dots, underscores, hyphens
        clean = clean.Replace('.', ' ').Replace('_', ' ').Trim();
        return (clean, year);
    }

    private static string ComputeQuickFileHash(string filePath)
    {
        using var stream = File.OpenRead(filePath);
        // Hash first 1MB of file for fast duplicate detection
        var buffer = new byte[Math.Min(1024 * 1024, stream.Length)];
        stream.Read(buffer, 0, buffer.Length);
        using var sha256 = SHA256.Create();
        var hash = sha256.ComputeHash(buffer);
        return Convert.ToHexString(hash);
    }

    private async Task GenerateArtworkIfMissingAsync(
        MediaFile mediaFile,
        MediaProbeResult probe,
        LibraryType type,
        CancellationToken cancellationToken)
    {
        var mediaItemId = mediaFile.MediaItemId;
        if (mediaItemId == Guid.Empty) return;

        try
        {
            var mediaItem = await _context.MediaItems.FirstOrDefaultAsync(m => m.Id == mediaItemId, cancellationToken);
            if (mediaItem == null) return;

            // Auto-fetch description for movies if missing and connected to internet
            if (type == LibraryType.Movies && string.IsNullOrWhiteSpace(mediaItem.Overview))
            {
                try
                {
                    await _posterService.AutoFetchDescriptionOnlyAsync(mediaItemId, cancellationToken);
                }
                catch {}
            }

            if (mediaItem.PrimaryArtworkId != null) return;

            string? thumb = null;
            ArtworkType artType = ArtworkType.Poster;

            if (type == LibraryType.Movies && probe.DurationSeconds > 30)
            {
                bool autoFetched = false;
                try
                {
                    // As long as connected to internet, automatically fetch official theatrical poster and metadata!
                    autoFetched = await _posterService.AutoFetchSinglePosterAsync(mediaItemId, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Online metadata and poster auto-fetch failed for movie {MediaItemId}; falling back to local video frame", mediaItemId);
                }

                if (!autoFetched)
                {
                    thumb = await _thumbnails.GenerateVideoThumbnailAsync(mediaFile.AbsolutePath, probe.DurationSeconds * 0.15);
                    artType = ArtworkType.Poster;
                }
                else
                {
                    // Successfully fetched and assigned official artwork and description
                    return;
                }
            }
            else if (type == LibraryType.TVShows && probe.DurationSeconds > 10)
            {
                thumb = await _thumbnails.GenerateVideoThumbnailAsync(mediaFile.AbsolutePath, probe.DurationSeconds * 0.2);
                artType = ArtworkType.Still;

                // Automatically fetch official series poster & description online for future & added web series / TV shows!
                try
                {
                    var episode = await _context.Episodes
                        .Include(e => e.Season)
                            .ThenInclude(s => s!.TVShow)
                                .ThenInclude(ts => ts!.MediaItem)
                        .FirstOrDefaultAsync(e => e.MediaItemId == mediaItemId, cancellationToken);

                    if (episode?.Season?.TVShow?.MediaItem != null)
                    {
                        var showMediaItem = episode.Season.TVShow.MediaItem;
                        if (showMediaItem.PrimaryArtworkId == null || string.IsNullOrWhiteSpace(showMediaItem.Overview))
                        {
                            await _posterService.AutoFetchSingleTvPosterAsync(episode.Season.TVShow.Id, cancellationToken);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Online metadata auto-fetch failed for TV show episode {MediaItemId}", mediaItemId);
                }
            }
            else if (type == LibraryType.Photos)
            {
                thumb = await _thumbnails.GeneratePhotoThumbnailAsync(mediaFile.AbsolutePath, 480, cancellationToken);
                artType = ArtworkType.Thumb;
            }
            else if (type == LibraryType.Music)
            {
                thumb = await _thumbnails.ExtractAudioCoverArtAsync(mediaFile.AbsolutePath, cancellationToken);
                artType = ArtworkType.Cover;
            }

            if (!string.IsNullOrEmpty(thumb))
            {
                var artwork = new Artwork
                {
                    MediaItemId = mediaItemId,
                    ArtworkType = artType,
                    AbsolutePath = thumb,
                    RelativePath = Path.GetFileName(thumb)
                };
                _context.Artworks.Add(artwork);
                await _context.SaveChangesAsync(cancellationToken);

                mediaItem.PrimaryArtworkId = artwork.Id;

                // Also populate Episode StillArtwork and TVShow Poster if missing
                if (type == LibraryType.TVShows)
                {
                    var ep = await _context.Episodes
                        .Include(e => e.Season)
                        .FirstOrDefaultAsync(e => e.MediaItemId == mediaItemId, cancellationToken);
                    if (ep != null)
                    {
                        ep.StillArtworkId = artwork.Id;

                        if (ep.Season != null)
                        {
                            var show = await _context.TVShows
                                .Include(s => s.MediaItem)
                                .FirstOrDefaultAsync(s => s.Id == ep.Season.TVShowId, cancellationToken);
                            if (show?.MediaItem != null && show.MediaItem.PrimaryArtworkId == null)
                            {
                                show.MediaItem.PrimaryArtworkId = artwork.Id;
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to generate thumbnail for {FilePath}", mediaFile.AbsolutePath);
        }
    }

    private async Task UpdateSearchIndexAsync(Guid mediaItemId, CancellationToken cancellationToken)
    {
        if (mediaItemId == Guid.Empty) return;

        var item = await _context.MediaItems
            .Include(m => m.Genres).ThenInclude(g => g.Genre)
            .Include(m => m.Tags).ThenInclude(t => t.Tag)
            .FirstOrDefaultAsync(m => m.Id == mediaItemId, cancellationToken);

        if (item == null) return;

        var secondary = string.Join(" ", item.Genres.Select(g => g.Genre?.Name).Where(n => n != null));

        try
        {
            await _context.Database.ExecuteSqlRawAsync(@"
                DELETE FROM MediaSearchIndex WHERE MediaItemId = {0};
                INSERT INTO MediaSearchIndex(MediaItemId, Title, OriginalTitle, Overview, SecondaryText, MediaType, Year)
                VALUES({0}, {1}, {2}, {3}, {4}, {5}, {6});
            ", item.Id.ToString(), item.Title, item.OriginalTitle ?? "", item.Overview ?? "", secondary, item.Type.ToString(), item.Year?.ToString() ?? "");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to update FTS index for {MediaItemId}", mediaItemId);
        }
    }
}
