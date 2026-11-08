using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;
using Vistara.MediaEngine;
using Vistara.Services.Tasks;

namespace Vistara.Services.Playback;

public interface IPlaybackService
{
    Task<MediaFilePlaybackInfoDto> PreparePlaybackAsync(Guid mediaFileId, string? clientId = null, CancellationToken cancellationToken = default);
    Task<PlaybackProgressDto> UpdateProgressAsync(PlaybackProgressRequest request, CancellationToken cancellationToken = default);
    Task StopPlaybackAsync(Guid mediaFileId, string? clientId = null, CancellationToken cancellationToken = default);
    Task<PlaybackProgressDto?> GetProgressAsync(Guid mediaItemId, CancellationToken cancellationToken = default);
    Task<EpisodeDto?> GetNextEpisodeAsync(Guid currentEpisodeId, CancellationToken cancellationToken = default);
    Task<bool> DeleteProgressAsync(Guid mediaItemId, CancellationToken cancellationToken = default);
}

public class PlaybackService : IPlaybackService
{
    private readonly VistaraDbContext _context;
    private readonly ITranscoderService _transcoder;
    private readonly IBackgroundTaskManager _taskManager;

    public PlaybackService(
        VistaraDbContext context,
        ITranscoderService transcoder,
        IBackgroundTaskManager taskManager)
    {
        _context = context;
        _transcoder = transcoder;
        _taskManager = taskManager;
    }

    public async Task<MediaFilePlaybackInfoDto> PreparePlaybackAsync(Guid mediaFileId, string? clientId = null, CancellationToken cancellationToken = default)
    {
        var mediaFile = await _context.MediaFiles
            .Include(f => f.MediaItem)
            .Include(f => f.Streams)
            .FirstOrDefaultAsync(f => f.Id == mediaFileId, cancellationToken);

        if (mediaFile == null || mediaFile.MediaItem == null)
            throw new ArgumentException($"Media file with id '{mediaFileId}' not found.");

        _taskManager.NotifyActivePlayback(true);

        var mode = _transcoder.DeterminePlaybackMode(mediaFile);
        var progress = await _context.PlaybackProgress
            .Where(p => p.MediaItemId == mediaFile.MediaItemId)
            .OrderByDescending(p => p.LastPlayedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        double resumeSeconds = 0;
        if (progress != null && !progress.IsCompleted && progress.PositionSeconds > 5 && progress.PositionSeconds < (progress.DurationSeconds - 15))
        {
            resumeSeconds = progress.PositionSeconds;
        }

        var audioStreams = mediaFile.Streams.Where(s => s.StreamType == MediaStreamType.Audio).ToList();
        var defaultAudio = audioStreams.FirstOrDefault(s => s.IsDefault) ?? audioStreams.FirstOrDefault();
        var activeAudioIndex = (progress?.SelectedAudioStreamIndex != null && audioStreams.Any(s => s.StreamIndex == progress.SelectedAudioStreamIndex.Value))
            ? progress.SelectedAudioStreamIndex.Value
            : defaultAudio?.StreamIndex;

        var result = new MediaFilePlaybackInfoDto
        {
            MediaFileId = mediaFile.Id,
            MediaItemId = mediaFile.MediaItemId,
            Title = mediaFile.MediaItem.Title,
            DurationSeconds = mediaFile.DurationSeconds,
            ResumePositionSeconds = resumeSeconds,
            ContainerFormat = mediaFile.ContainerFormat ?? "unknown",
            VideoCodec = mediaFile.VideoCodec,
            AudioCodec = mediaFile.AudioCodec,
            Width = mediaFile.ResolutionWidth,
            Height = mediaFile.ResolutionHeight,
            FrameRate = mediaFile.FrameRate,
            BitrateKbps = mediaFile.BitrateKbps,
            DirectPlaySupported = mode == PlaybackPipelineMode.DirectPlay,
            SelectedAudioStreamIndex = activeAudioIndex
        };

        if (mode == PlaybackPipelineMode.DirectPlay)
        {
            result.StreamUrl = $"/api/v1/stream/{mediaFile.Id}";
        }
        else if (mode == PlaybackPipelineMode.DirectStream)
        {
            result.StreamUrl = activeAudioIndex.HasValue
                ? $"/api/v1/stream/{mediaFile.Id}?remux=true&audioIndex={activeAudioIndex.Value}"
                : $"/api/v1/stream/{mediaFile.Id}?remux=true";
        }
        else
        {
            result.StreamUrl = $"/api/v1/stream/{mediaFile.Id}?transcode=true";
            result.HlsStreamUrl = $"/api/v1/stream/{mediaFile.Id}/hls/index.m3u8";
        }

        // Map streams
        result.Streams = mediaFile.Streams.Select(s => new MediaStreamInfoDto
        {
            Index = s.StreamIndex,
            Type = s.StreamType,
            Codec = s.Codec,
            Profile = s.Profile,
            Language = s.Language,
            Title = s.Title,
            IsDefault = s.IsDefault,
            Channels = s.Channels,
            SampleRate = s.SampleRate,
            Width = s.Width,
            Height = s.Height,
            BitrateKbps = s.BitrateKbps
        }).ToList();

        // If it's an episode, check for series info, skip markers and next episode
        var episode = await _context.Episodes
            .Include(e => e.Season)
                .ThenInclude(s => s.TVShow)
                    .ThenInclude(t => t.MediaItem)
            .FirstOrDefaultAsync(e => e.MediaItemId == mediaFile.MediaItemId, cancellationToken);

        if (episode != null)
        {
            result.MediaType = "series";
            result.SeriesTitle = episode.Season?.TVShow?.MediaItem?.Title;
            result.SeasonNumber = episode.Season?.SeasonNumber ?? 1;
            result.EpisodeNumber = episode.EpisodeNumber;
            result.ImdbId = episode.Season?.TVShow?.ImdbId;
            result.IntroStartSeconds = episode.IntroStartSeconds;
            result.IntroEndSeconds = episode.IntroEndSeconds;
            result.CreditsStartSeconds = episode.CreditsStartSeconds;

            var nextEp = await GetNextEpisodeAsync(episode.Id, cancellationToken);
            if (nextEp != null)
            {
                result.NextEpisodeId = nextEp.MediaFileId;
                result.NextEpisodeTitle = nextEp.Title;
            }
        }
        else
        {
            var movie = await _context.Movies
                .FirstOrDefaultAsync(m => m.MediaItemId == mediaFile.MediaItemId, cancellationToken);
            if (movie != null)
            {
                result.MediaType = "movie";
                result.ImdbId = movie.ImdbId;
            }
        }

        return result;
    }

    public async Task<PlaybackProgressDto> UpdateProgressAsync(PlaybackProgressRequest request, CancellationToken cancellationToken = default)
    {
        var progress = await _context.PlaybackProgress
            .FirstOrDefaultAsync(p => p.MediaItemId == request.MediaItemId && p.MediaFileId == request.MediaFileId, cancellationToken);

        if (progress == null)
        {
            progress = new PlaybackProgress
            {
                MediaItemId = request.MediaItemId,
                MediaFileId = request.MediaFileId
            };
            _context.PlaybackProgress.Add(progress);
        }

        progress.PositionSeconds = request.PositionSeconds;
        progress.DurationSeconds = request.DurationSeconds;
        progress.LastPlayedUtc = DateTime.UtcNow;

        if (request.SelectedAudioStreamIndex.HasValue)
            progress.SelectedAudioStreamIndex = request.SelectedAudioStreamIndex;
        if (request.SelectedSubtitleStreamIndex.HasValue)
            progress.SelectedSubtitleStreamIndex = request.SelectedSubtitleStreamIndex;

        if (request.DurationSeconds > 0)
        {
            progress.PercentageWatched = Math.Round((request.PositionSeconds / request.DurationSeconds) * 100, 1);
            // Default 90% completion threshold; replaying unmarks completion
            progress.IsCompleted = progress.PercentageWatched >= 90;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new PlaybackProgressDto
        {
            MediaItemId = progress.MediaItemId,
            MediaFileId = progress.MediaFileId,
            PositionSeconds = progress.PositionSeconds,
            DurationSeconds = progress.DurationSeconds,
            PercentageWatched = progress.PercentageWatched,
            IsCompleted = progress.IsCompleted,
            LastPlayedUtc = progress.LastPlayedUtc,
            SelectedAudioStreamIndex = progress.SelectedAudioStreamIndex,
            SelectedSubtitleStreamIndex = progress.SelectedSubtitleStreamIndex
        };
    }

    public async Task StopPlaybackAsync(Guid mediaFileId, string? clientId = null, CancellationToken cancellationToken = default)
    {
        _taskManager.NotifyActivePlayback(false);
        await Task.CompletedTask;
    }

    public async Task<PlaybackProgressDto?> GetProgressAsync(Guid mediaItemId, CancellationToken cancellationToken = default)
    {
        var progress = await _context.PlaybackProgress
            .OrderByDescending(p => p.LastPlayedUtc)
            .FirstOrDefaultAsync(p => p.MediaItemId == mediaItemId, cancellationToken);

        if (progress == null) return null;

        return new PlaybackProgressDto
        {
            MediaItemId = progress.MediaItemId,
            MediaFileId = progress.MediaFileId,
            PositionSeconds = progress.PositionSeconds,
            DurationSeconds = progress.DurationSeconds,
            PercentageWatched = progress.PercentageWatched,
            IsCompleted = progress.IsCompleted,
            LastPlayedUtc = progress.LastPlayedUtc,
            SelectedAudioStreamIndex = progress.SelectedAudioStreamIndex,
            SelectedSubtitleStreamIndex = progress.SelectedSubtitleStreamIndex
        };
    }

    public async Task<EpisodeDto?> GetNextEpisodeAsync(Guid currentEpisodeId, CancellationToken cancellationToken = default)
    {
        var current = await _context.Episodes
            .Include(e => e.Season)
            .FirstOrDefaultAsync(e => e.Id == currentEpisodeId, cancellationToken);

        if (current == null || current.Season == null) return null;

        // Try next episode in the same season
        var nextInSeason = await _context.Episodes
            .Include(e => e.MediaItem)
                .ThenInclude(m => m!.Files)
            .Where(e => e.SeasonId == current.SeasonId && e.EpisodeNumber > current.EpisodeNumber)
            .OrderBy(e => e.EpisodeNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (nextInSeason?.MediaItem?.Files.FirstOrDefault() != null)
        {
            return MapToEpisodeDto(nextInSeason, current.Season.SeasonNumber);
        }

        // Otherwise try first episode in next season
        var nextSeason = await _context.Seasons
            .Include(s => s.Episodes)
                .ThenInclude(e => e.MediaItem)
                    .ThenInclude(m => m!.Files)
            .Where(s => s.TVShowId == current.Season.TVShowId && s.SeasonNumber > current.Season.SeasonNumber)
            .OrderBy(s => s.SeasonNumber)
            .FirstOrDefaultAsync(cancellationToken);

        var firstInNextSeason = nextSeason?.Episodes
            .OrderBy(e => e.EpisodeNumber)
            .FirstOrDefault();

        if (firstInNextSeason?.MediaItem?.Files.FirstOrDefault() != null)
        {
            return MapToEpisodeDto(firstInNextSeason, nextSeason!.SeasonNumber);
        }

        return null;
    }

    private static EpisodeDto MapToEpisodeDto(Episode episode, int seasonNumber) => new()
    {
        Id = episode.MediaItemId,
        EpisodeId = episode.Id,
        SeasonId = episode.SeasonId,
        SeasonNumber = seasonNumber,
        EpisodeNumber = episode.EpisodeNumber,
        Title = episode.Title,
        Overview = episode.Overview,
        AirDate = episode.AirDate,
        IntroStartSeconds = episode.IntroStartSeconds,
        IntroEndSeconds = episode.IntroEndSeconds,
        CreditsStartSeconds = episode.CreditsStartSeconds,
        DurationSeconds = episode.MediaItem?.Files.FirstOrDefault()?.DurationSeconds ?? 0,
        MediaFileId = episode.MediaItem?.Files.FirstOrDefault()?.Id ?? Guid.Empty
    };

    public async Task<bool> DeleteProgressAsync(Guid mediaItemId, CancellationToken cancellationToken = default)
    {
        var records = await _context.PlaybackProgress
            .Where(p => p.MediaItemId == mediaItemId)
            .ToListAsync(cancellationToken);

        if (records.Count == 0) return false;

        _context.PlaybackProgress.RemoveRange(records);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}

