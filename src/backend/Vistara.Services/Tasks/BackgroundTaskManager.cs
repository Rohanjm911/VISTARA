using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Services.Tasks;

public interface IBackgroundTaskManager
{
    Guid EnqueueJob(JobType type, Func<CancellationToken, IProgress<double>, Task> workItem, string? initialMessage = null);
    List<BackgroundJobDto> GetActiveJobs();
    BackgroundJobDto? GetJob(Guid jobId);
    bool CancelJob(Guid jobId);
    bool PauseJob(Guid jobId);
    bool ResumeJob(Guid jobId);
    void NotifyActivePlayback(bool isPlaying);
}

public class BackgroundTaskManager : BackgroundService, IBackgroundTaskManager
{
    private readonly ILogger<BackgroundTaskManager> _logger;
    private readonly Channel<InternalJobItem> _channel = Channel.CreateUnbounded<InternalJobItem>();
    private readonly ConcurrentDictionary<Guid, InternalJobItem> _jobs = new();
    private volatile bool _isPlaybackActive = false;

    private class InternalJobItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public JobType Type { get; set; }
        public JobStatus Status { get; set; } = JobStatus.Pending;
        public double ProgressPercentage { get; set; }
        public string? ProgressMessage { get; set; }
        public DateTime StartTimeUtc { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedTimeUtc { get; set; }
        public string? ErrorMessage { get; set; }
        public Func<CancellationToken, IProgress<double>, Task> WorkItem { get; set; } = null!;
        public CancellationTokenSource Cts { get; set; } = new();
        public ManualResetEventSlim PauseEvent { get; set; } = new(true);
    }

    public BackgroundTaskManager(ILogger<BackgroundTaskManager> logger)
    {
        _logger = logger;
    }

    public Guid EnqueueJob(JobType type, Func<CancellationToken, IProgress<double>, Task> workItem, string? initialMessage = null)
    {
        var job = new InternalJobItem
        {
            Type = type,
            WorkItem = workItem,
            ProgressMessage = initialMessage
        };

        _jobs[job.Id] = job;
        _channel.Writer.TryWrite(job);
        return job.Id;
    }

    public List<BackgroundJobDto> GetActiveJobs()
    {
        return _jobs.Values
            .Select(MapToDto)
            .OrderByDescending(j => j.StartTimeUtc)
            .ToList();
    }

    public BackgroundJobDto? GetJob(Guid jobId)
    {
        return _jobs.TryGetValue(jobId, out var job) ? MapToDto(job) : null;
    }

    public bool CancelJob(Guid jobId)
    {
        if (_jobs.TryGetValue(jobId, out var job))
        {
            job.Cts.Cancel();
            job.Status = JobStatus.Cancelled;
            job.CompletedTimeUtc = DateTime.UtcNow;
            return true;
        }
        return false;
    }

    public bool PauseJob(Guid jobId)
    {
        if (_jobs.TryGetValue(jobId, out var job) && job.Status == JobStatus.Running)
        {
            job.PauseEvent.Reset();
            job.Status = JobStatus.Paused;
            return true;
        }
        return false;
    }

    public bool ResumeJob(Guid jobId)
    {
        if (_jobs.TryGetValue(jobId, out var job) && job.Status == JobStatus.Paused)
        {
            job.PauseEvent.Set();
            job.Status = JobStatus.Running;
            return true;
        }
        return false;
    }

    public void NotifyActivePlayback(bool isPlaying)
    {
        _isPlaybackActive = isPlaying;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Vistara BackgroundTaskManager started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var job = await _channel.Reader.ReadAsync(stoppingToken);

                // Resource throttle: if active video playback is occurring, pause or yield to keep playback smooth
                if (_isPlaybackActive && job.Type != JobType.Transcode)
                {
                    await Task.Delay(1000, stoppingToken);
                }

                job.Status = JobStatus.Running;
                var progressReporter = new Progress<double>(p =>
                {
                    job.ProgressPercentage = Math.Round(p, 1);
                });

                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, job.Cts.Token);

                try
                {
                    await job.WorkItem(linkedCts.Token, progressReporter);
                    job.Status = JobStatus.Completed;
                    job.ProgressPercentage = 100;
                }
                catch (OperationCanceledException)
                {
                    job.Status = JobStatus.Cancelled;
                }
                catch (Exception ex)
                {
                    job.Status = JobStatus.Failed;
                    job.ErrorMessage = ex.Message;
                    _logger.LogError(ex, "Background job {JobId} failed.", job.Id);
                }
                finally
                {
                    job.CompletedTimeUtc = DateTime.UtcNow;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in BackgroundTaskManager.");
            }
        }
    }

    private static BackgroundJobDto MapToDto(InternalJobItem job) => new()
    {
        Id = job.Id,
        Type = job.Type,
        Status = job.Status,
        ProgressPercentage = job.ProgressPercentage,
        ProgressMessage = job.ProgressMessage,
        CanCancel = job.Status == JobStatus.Running || job.Status == JobStatus.Pending || job.Status == JobStatus.Paused,
        CanPause = job.Status == JobStatus.Running,
        StartTimeUtc = job.StartTimeUtc,
        CompletedTimeUtc = job.CompletedTimeUtc,
        ErrorMessage = job.ErrorMessage
    };
}

