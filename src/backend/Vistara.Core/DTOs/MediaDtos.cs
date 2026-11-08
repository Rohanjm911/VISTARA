using Vistara.Core.Enums;
using Vistara.Core.Models;

namespace Vistara.Core.DTOs;

public class LibraryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public LibraryType Type { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public bool AutoScanEnabled { get; set; }
    public int ScanIntervalMinutes { get; set; }
    public int ItemCount { get; set; }
    public long TotalSizeBytes { get; set; }
    public DateTime? LastScannedUtc { get; set; }
    public List<LibraryFolderDto> Folders { get; set; } = new();
}

public class LibraryFolderDto
{
    public Guid Id { get; set; }
    public Guid LibraryId { get; set; }
    public string Path { get; set; } = string.Empty;
    public bool IsMonitored { get; set; }
    public DateTime? LastScannedUtc { get; set; }
    public bool IsAccessible { get; set; }
}

public class ScanProgressDto
{
    public Guid LibraryId { get; set; }
    public Guid FolderId { get; set; }
    public int FilesDiscovered { get; set; }
    public int FilesProcessed { get; set; }
    public string CurrentFile { get; set; } = string.Empty;
    public double Percentage { get; set; }
    public string Status { get; set; } = "Processing";
    public string? ErrorMessage { get; set; }
}

public class MovieDto
{
    public Guid Id { get; set; } // MediaItemId
    public Guid MovieId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? OriginalTitle { get; set; }
    public int? Year { get; set; }
    public string? Overview { get; set; }
    public string? Tagline { get; set; }
    public int? RuntimeMinutes { get; set; }
    public double? CommunityRating { get; set; }
    public string? ContentRating { get; set; }
    public string? Director { get; set; }
    public string? Writers { get; set; }
    public string? Cast { get; set; }
    public string? Studio { get; set; }
    public bool IsFavourite { get; set; }
    public bool IsInWatchlist { get; set; }
    public string? PosterUrl { get; set; }
    public string? BackdropUrl { get; set; }
    public List<string> Genres { get; set; } = new();
    public List<MovieEditionDto> Editions { get; set; } = new();
    public PlaybackProgressDto? Progress { get; set; }
}

public class MovieEditionDto
{
    public Guid Id { get; set; }
    public Guid MediaFileId { get; set; }
    public string EditionName { get; set; } = "Theatrical";
    public string? ResolutionLabel { get; set; }
    public long FileSizeBytes { get; set; }
    public string? ContainerFormat { get; set; }
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public double DurationSeconds { get; set; }
    public bool IsMissing { get; set; }
}

public class TVShowDto
{
    public Guid Id { get; set; } // MediaItemId
    public Guid ShowId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? Overview { get; set; }
    public string? Network { get; set; }
    public string? Status { get; set; }
    public string? Cast { get; set; }
    public double? CommunityRating { get; set; }
    public bool IsFavourite { get; set; }
    public bool IsInWatchlist { get; set; }
    public string? PosterUrl { get; set; }
    public string? BackdropUrl { get; set; }
    public List<string> Genres { get; set; } = new();
    public int SeasonCount { get; set; }
    public int EpisodeCount { get; set; }
    public int WatchedEpisodeCount { get; set; }
}

public class SeasonDto
{
    public Guid Id { get; set; }
    public Guid TVShowId { get; set; }
    public int SeasonNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Overview { get; set; }
    public string? PosterUrl { get; set; }
    public List<EpisodeDto> Episodes { get; set; } = new();
}

public class EpisodeDto
{
    public Guid Id { get; set; } // MediaItemId
    public Guid EpisodeId { get; set; }
    public Guid SeasonId { get; set; }
    public int SeasonNumber { get; set; }
    public int EpisodeNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? SeriesTitle { get; set; }
    public string? Overview { get; set; }
    public DateTime? AirDate { get; set; }
    public double? IntroStartSeconds { get; set; }
    public double? IntroEndSeconds { get; set; }
    public double? CreditsStartSeconds { get; set; }
    public string? StillUrl { get; set; }
    public double DurationSeconds { get; set; }
    public Guid MediaFileId { get; set; }
    public PlaybackProgressDto? Progress { get; set; }
}

public class TrackDto
{
    public Guid Id { get; set; } // MediaItemId
    public Guid TrackId { get; set; }
    public Guid? AlbumId { get; set; }
    public string? AlbumTitle { get; set; }
    public Guid? ArtistId { get; set; }
    public string? ArtistName { get; set; }
    public string Title { get; set; } = string.Empty;
    public int? TrackNumber { get; set; }
    public int? DiscNumber { get; set; }
    public double DurationSeconds { get; set; }
    public int? Year { get; set; }
    public string? Genre { get; set; }
    public string? Lyrics { get; set; }
    public string? ArtworkUrl { get; set; }
    public Guid MediaFileId { get; set; }
    public double? ReplayGainTrackGain { get; set; }
    public bool IsFavourite { get; set; }
    public string? AudioFormat { get; set; }
    public string? AudioCodec { get; set; }
    public int? BitrateKbps { get; set; }
    public int? SampleRate { get; set; }
    public int? Channels { get; set; }
    public long? FileSizeBytes { get; set; }
}

public class AlbumDto
{
    public Guid Id { get; set; }
    public Guid ArtistId { get; set; }
    public string ArtistName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int? ReleaseYear { get; set; }
    public string? Genre { get; set; }
    public int? TotalTracks { get; set; }
    public string? ArtworkUrl { get; set; }
    public List<TrackDto> Tracks { get; set; } = new();
}

public class ArtistDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Biography { get; set; }
    public string? Country { get; set; }
    public string? Genres { get; set; }
    public string? ArtworkUrl { get; set; }
    public int AlbumCount { get; set; }
    public int TrackCount { get; set; }
}

public class PhotoDto
{
    public Guid Id { get; set; } // MediaItemId
    public Guid PhotoId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime? DateTakenUtc { get; set; }
    public string? CameraMake { get; set; }
    public string? CameraModel { get; set; }
    public string? LensModel { get; set; }
    public double? FocalLengthMm { get; set; }
    public double? ApertureFNumber { get; set; }
    public string? ShutterSpeed { get; set; }
    public int? IsoSpeed { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Orientation { get; set; }
    public string? LocationName { get; set; }
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string FullImageUrl { get; set; } = string.Empty;
    public bool IsFavourite { get; set; }
    public Guid MediaFileId { get; set; }
    public long FileSizeBytes { get; set; }
}

public class PhotoAlbumDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public int PhotoCount { get; set; }
}

public class PlaylistDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverUrl { get; set; }
    public int ItemCount { get; set; }
    public double TotalDurationSeconds { get; set; }
    public List<PlaylistItemDto> Items { get; set; } = new();
}

public class PlaylistItemDto
{
    public Guid Id { get; set; }
    public Guid MediaItemId { get; set; }
    public MediaType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public double DurationSeconds { get; set; }
    public string? ArtworkUrl { get; set; }
    public int Position { get; set; }
    public Guid MediaFileId { get; set; }
}

public class PlaybackProgressDto
{
    public Guid MediaItemId { get; set; }
    public Guid MediaFileId { get; set; }
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public double PercentageWatched { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime LastPlayedUtc { get; set; }
    public int? SelectedAudioStreamIndex { get; set; }
    public int? SelectedSubtitleStreamIndex { get; set; }
}

public class DashboardDto
{
    public List<MovieDto> ContinueWatchingMovies { get; set; } = new();
    public List<EpisodeDto> ContinueWatchingEpisodes { get; set; } = new();
    public List<MovieDto> RecentlyAddedMovies { get; set; } = new();
    public List<TVShowDto> RecentlyAddedShows { get; set; } = new();
    public List<TrackDto> RecentlyPlayedMusic { get; set; } = new();
    public List<PhotoDto> RecentlyAddedPhotos { get; set; } = new();
    public List<MovieDto> FavouriteMovies { get; set; } = new();
    public LibraryStatisticsDto Statistics { get; set; } = new();
    public StorageUsageDto StorageUsage { get; set; } = new();
    public List<BackgroundJobDto> ActiveJobs { get; set; } = new();
}

public class LibraryStatisticsDto
{
    public int TotalMovies { get; set; }
    public int TotalShows { get; set; }
    public int TotalEpisodes { get; set; }
    public int TotalTracks { get; set; }
    public int TotalAlbums { get; set; }
    public int TotalArtists { get; set; }
    public int TotalPhotos { get; set; }
    public int TotalPlaylists { get; set; }
    public double TotalWatchTimeHours { get; set; }
}

public class StorageUsageDto
{
    public long MoviesSizeBytes { get; set; }
    public long TvShowsSizeBytes { get; set; }
    public long MusicSizeBytes { get; set; }
    public long PhotosSizeBytes { get; set; }
    public long CustomSizeBytes { get; set; }
    public long TotalSizeBytes => MoviesSizeBytes + TvShowsSizeBytes + MusicSizeBytes + PhotosSizeBytes + CustomSizeBytes;
}

public class BackgroundJobDto
{
    public Guid Id { get; set; }
    public JobType Type { get; set; }
    public JobStatus Status { get; set; }
    public double ProgressPercentage { get; set; }
    public string? ProgressMessage { get; set; }
    public bool CanCancel { get; set; }
    public bool CanPause { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public DateTime? CompletedTimeUtc { get; set; }
    public string? ErrorMessage { get; set; }
}

public class SearchResultDto
{
    public string Query { get; set; } = string.Empty;
    public List<MovieDto> Movies { get; set; } = new();
    public List<TVShowDto> TVShows { get; set; } = new();
    public List<EpisodeDto> Episodes { get; set; } = new();
    public List<TrackDto> Tracks { get; set; } = new();
    public List<ArtistDto> Artists { get; set; } = new();
    public List<AlbumDto> Albums { get; set; } = new();
    public List<PhotoDto> Photos { get; set; } = new();
}

public class SystemHealthDto
{
    public string Status { get; set; } = "Healthy";
    public string Version { get; set; } = "1.0.0";
    public bool DatabaseConnected { get; set; } = true;
    public bool FFmpegInstalled { get; set; }
    public string? FFmpegVersion { get; set; }
    public bool FFprobeInstalled { get; set; }
    public List<string> HardwareAccelerationMethods { get; set; } = new();
    public long MemoryUsedBytes { get; set; }
    public double CpuUsagePercent { get; set; }
    public TimeSpan Uptime { get; set; }
    public string OperatingSystem { get; set; } = "Windows";
}

public class PlaybackStartRequest
{
    public Guid MediaItemId { get; set; }
    public Guid MediaFileId { get; set; }
    public string? ClientId { get; set; }
    public string? DeviceName { get; set; }
}

public class PlaybackProgressRequest
{
    public Guid MediaItemId { get; set; }
    public Guid MediaFileId { get; set; }
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public int? SelectedAudioStreamIndex { get; set; }
    public int? SelectedSubtitleStreamIndex { get; set; }
    public bool IsPaused { get; set; }
}

public class MediaStreamInfoDto
{
    public int Index { get; set; }
    public MediaStreamType Type { get; set; }
    public string Codec { get; set; } = string.Empty;
    public string? Profile { get; set; }
    public string? Language { get; set; }
    public string? Title { get; set; }
    public bool IsDefault { get; set; }
    public int? Channels { get; set; }
    public int? SampleRate { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public int? BitrateKbps { get; set; }
}

public class MediaFilePlaybackInfoDto
{
    public Guid MediaFileId { get; set; }
    public Guid MediaItemId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string MediaType { get; set; } = "movie"; // "movie" or "series"
    public string? SeriesTitle { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public string? ImdbId { get; set; }
    public string StreamUrl { get; set; } = string.Empty;
    public string? HlsStreamUrl { get; set; }
    public double DurationSeconds { get; set; }
    public double ResumePositionSeconds { get; set; }
    public string ContainerFormat { get; set; } = string.Empty;
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? FrameRate { get; set; }
    public int? BitrateKbps { get; set; }
    public bool DirectPlaySupported { get; set; }
    public int? SelectedAudioStreamIndex { get; set; }
    public List<MediaStreamInfoDto> Streams { get; set; } = new();
    public double? IntroStartSeconds { get; set; }
    public double? IntroEndSeconds { get; set; }
    public double? CreditsStartSeconds { get; set; }
    public Guid? NextEpisodeId { get; set; }
    public string? NextEpisodeTitle { get; set; }
}

public class OnlineSubtitleResultDto
{
    public string Id { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string LanguageName { get; set; } = string.Empty;
    public string DownloadUrl { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Source { get; set; } = "OpenSubtitles";
}

public class SearchSubtitlesRequest
{
    public string? Query { get; set; }
    public string? ImdbId { get; set; }
    public string Type { get; set; } = "movie";
    public int? Season { get; set; }
    public int? Episode { get; set; }
    public string? Language { get; set; }
}

public class DownloadOnlineSubtitleRequest
{
    public string DownloadUrl { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string? Title { get; set; }
    public Guid? MediaFileId { get; set; }
}

public class DownloadOnlineSubtitleResponse
{
    public string SubtitleUrl { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string CacheFileName { get; set; } = string.Empty;
}

public class LyricsResultDto
{
    public Guid TrackId { get; set; }
    public string? Lyrics { get; set; }
    public bool IsSynced { get; set; }
    public string Source { get; set; } = "embedded";
    public string? TrackTitle { get; set; }
    public string? ArtistName { get; set; }
    public string? AlbumName { get; set; }
    public double? DurationSeconds { get; set; }
}

public class FetchLyricsRequest
{
    public string? TrackTitle { get; set; }
    public string? ArtistName { get; set; }
    public string? AlbumName { get; set; }
    public bool Force { get; set; }
}

public class LrcLibSearchResultDto
{
    public int Id { get; set; }
    public string TrackName { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public string? AlbumName { get; set; }
    public double Duration { get; set; }
    public bool Instrumental { get; set; }
    public bool HasSyncedLyrics { get; set; }
    public string? SyncedLyrics { get; set; }
    public string? PlainLyrics { get; set; }
}

public class TranslateLyricsRequest
{
    public Guid? TrackId { get; set; }
    public string? Lyrics { get; set; }
    public string TargetLanguage { get; set; } = "en";
}

public class TranslatedLyricLineDto
{
    public double? Time { get; set; }
    public string Original { get; set; } = string.Empty;
    public string Translated { get; set; } = string.Empty;
}

public class TranslatedLyricsResultDto
{
    public Guid? TrackId { get; set; }
    public string SourceLanguage { get; set; } = "auto";
    public string TargetLanguage { get; set; } = "en";
    public List<TranslatedLyricLineDto> Lines { get; set; } = new();
}

public class PosterSearchResultDto
{
    public string Title { get; set; } = string.Empty;
    public string? Year { get; set; }
    public string? ImdbId { get; set; }
    public string PosterUrl { get; set; } = string.Empty;
    public string? BackdropUrl { get; set; }
    public string? Overview { get; set; }
    public List<string> Genres { get; set; } = new();
    public double? Rating { get; set; }
    public string? Director { get; set; }
    public string? Cast { get; set; }
}

public class ImportPosterRequestDto
{
    public string PosterUrl { get; set; } = string.Empty;
    public string? BackdropUrl { get; set; }
    public bool UpdateMetadata { get; set; } = true;
    public string? CleanedTitle { get; set; }
    public int? Year { get; set; }
    public string? Overview { get; set; }
    public string? Director { get; set; }
    public string? Cast { get; set; }
    public double? CommunityRating { get; set; }
    public List<string>? Genres { get; set; }
}

public class AutoFetchAllResultDto
{
    public int TotalScanned { get; set; }
    public int UpdatedCount { get; set; }
    public int FailedCount { get; set; }
    public List<string> UpdatedTitles { get; set; } = new();
}

