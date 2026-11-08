using Microsoft.EntityFrameworkCore;
using Vistara.Core.Enums;
using Vistara.Core.Models;

namespace Vistara.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task InitializeAsync(VistaraDbContext context)
    {
        // Configure SQLite PRAGMAs
        await context.Database.OpenConnectionAsync();
        using (var command = context.Database.GetDbConnection().CreateCommand())
        {
            command.CommandText = "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;";
            await command.ExecuteNonQueryAsync();
        }

        // Ensure database and schema exists
        await context.Database.EnsureCreatedAsync();

        // Create FTS5 Search Index Table if it doesn't exist
        using (var command = context.Database.GetDbConnection().CreateCommand())
        {
            command.CommandText = @"
                CREATE VIRTUAL TABLE IF NOT EXISTS MediaSearchIndex USING fts5(
                    MediaItemId UNINDEXED,
                    Title,
                    OriginalTitle,
                    Overview,
                    SecondaryText,
                    MediaType,
                    Year,
                    tokenize='unicode61'
                );

                CREATE TABLE IF NOT EXISTS IntegrityScans (
                    Id TEXT PRIMARY KEY,
                    LibraryId TEXT,
                    ScanType INTEGER NOT NULL,
                    Status INTEGER NOT NULL,
                    StartedAtUtc TEXT NOT NULL,
                    CompletedAtUtc TEXT,
                    TotalFilesDiscovered INTEGER NOT NULL,
                    FilesVerified INTEGER NOT NULL,
                    FilesHealthy INTEGER NOT NULL,
                    FilesModified INTEGER NOT NULL,
                    FilesMissing INTEGER NOT NULL,
                    FilesCorrupted INTEGER NOT NULL,
                    FilesUnreadable INTEGER NOT NULL,
                    FilesDriveDisconnected INTEGER NOT NULL,
                    TotalBytesScanned INTEGER NOT NULL,
                    DurationMs INTEGER NOT NULL,
                    ErrorMessage TEXT,
                    TriggeredBy TEXT NOT NULL,
                    VerifyHash INTEGER NOT NULL,
                    RunFfprobe INTEGER NOT NULL,
                    CreatedAtUtc TEXT NOT NULL,
                    UpdatedAtUtc TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS IntegrityFileRecords (
                    Id TEXT PRIMARY KEY,
                    MediaFileId TEXT,
                    MediaItemId TEXT,
                    LibraryId TEXT NOT NULL,
                    FilePath TEXT NOT NULL UNIQUE,
                    DriveRoot TEXT NOT NULL,
                    IsDriveAccessible INTEGER NOT NULL,
                    FileSizeBytes INTEGER NOT NULL,
                    PreviousFileSizeBytes INTEGER,
                    FileModifiedTimeUtc TEXT,
                    PreviousFileModifiedTimeUtc TEXT,
                    Sha256Hash TEXT,
                    PreviousSha256Hash TEXT,
                    Status INTEGER NOT NULL,
                    CorruptionReason TEXT,
                    FfprobeValid INTEGER,
                    FfprobeDetails TEXT,
                    LastVerifiedAtUtc TEXT,
                    VerifiedCount INTEGER NOT NULL,
                    FailureCount INTEGER NOT NULL,
                    CreatedAtUtc TEXT NOT NULL,
                    UpdatedAtUtc TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS IntegrityVerificationHistories (
                    Id TEXT PRIMARY KEY,
                    IntegrityScanId TEXT,
                    MediaFileId TEXT,
                    FilePath TEXT NOT NULL,
                    VerifiedAtUtc TEXT NOT NULL,
                    ResultStatus INTEGER NOT NULL,
                    PreviousHash TEXT,
                    CurrentHash TEXT,
                    PreviousSize INTEGER,
                    CurrentSize INTEGER,
                    DurationMs INTEGER NOT NULL,
                    ErrorDetails TEXT,
                    CheckType TEXT NOT NULL,
                    CreatedAtUtc TEXT NOT NULL,
                    UpdatedAtUtc TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS IntegrityEvents (
                    Id TEXT PRIMARY KEY,
                    TimestampUtc TEXT NOT NULL,
                    EventType INTEGER NOT NULL,
                    Severity TEXT NOT NULL,
                    Title TEXT NOT NULL,
                    Description TEXT NOT NULL,
                    FilePath TEXT,
                    MediaFileId TEXT,
                    Resolved INTEGER NOT NULL,
                    ResolvedAtUtc TEXT,
                    CreatedAtUtc TEXT NOT NULL,
                    UpdatedAtUtc TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS IX_IntegrityFileRecords_Status ON IntegrityFileRecords(Status);
                CREATE INDEX IF NOT EXISTS IX_IntegrityFileRecords_LibraryId ON IntegrityFileRecords(LibraryId);
                CREATE INDEX IF NOT EXISTS IX_IntegrityScans_Status ON IntegrityScans(Status);
                CREATE INDEX IF NOT EXISTS IX_IntegrityEvents_TimestampUtc ON IntegrityEvents(TimestampUtc);
            ";
            await command.ExecuteNonQueryAsync();
        }

        // Seed AppSettings
        var defaultSettings = new Dictionary<string, (string Value, string Category, string Description)>
        {
            { "Appearance.Theme", ("dark", "Appearance", "Current UI theme: dark or light") },
            { "Appearance.AccentColor", ("#7c3aed", "Appearance", "Accent color hex code") },
            { "Playback.AutoPlayNext", ("true", "Playback", "Automatically play next episode") },
            { "Playback.CompletionThresholdPercent", ("90", "Playback", "Percentage watched to mark as completed") },
            { "Playback.ResumeThresholdSeconds", ("15", "Playback", "Minimum seconds to save resume position") },
            { "Playback.HardwareAcceleration", ("auto", "Playback", "Hardware acceleration mode: auto, hardware, software") },
            { "Subtitles.DefaultLanguage", ("eng", "Subtitles", "Preferred subtitle language") },
            { "Subtitles.FontSize", ("18", "Subtitles", "Subtitle font size in px") },
            { "Subtitles.TextColor", ("#ffffff", "Subtitles", "Subtitle text color") },
            { "Subtitles.BackgroundColor", ("#000000aa", "Subtitles", "Subtitle background color") },
            { "Audio.VolumeNormalization", ("true", "Audio", "Enable ReplayGain / dynamic volume normalization") },
            { "Audio.PreferredLanguage", ("eng", "Audio", "Preferred audio track language") },
            { "FFmpeg.ExecutablePath", (@"C:\ffmpeg\ffmpeg.exe", "FFmpeg", "Path to ffmpeg binary") },
            { "FFprobe.ExecutablePath", (@"C:\ffmpeg\ffprobe.exe", "FFmpeg", "Path to ffprobe binary") },
            { "Metadata.EnableOnlineLookup", ("false", "Metadata", "Allow optional online metadata lookup") },
            { "Library.MonitoringEnabled", ("true", "Library", "Auto-monitor library folders for filesystem changes") },
            { "Backup.AutoBackupSchedule", ("daily", "Backup", "Automatic backup schedule: daily, weekly, off") },
            { "Backup.DailyRetentionCount", ("7", "Backup", "Number of daily backups to keep") },
            { "Backup.WeeklyRetentionCount", ("4", "Backup", "Number of weekly backups to keep") },
            { "Backup.MonthlyRetentionCount", ("12", "Backup", "Number of monthly backups to keep") },
            { "Integrity.VerificationStrategy", ("SmartIncremental", "Integrity", "Verification strategy: SmartIncremental, FullHash, ContainerProbeOnly") },
            { "Integrity.ScanPriority", ("Normal", "Integrity", "Scan thread priority: Low, Normal, High") },
            { "Integrity.MaxConcurrency", ("2", "Integrity", "Maximum concurrent file verification workers") },
            { "Integrity.PauseDuringPlayback", ("true", "Integrity", "Automatically pause verification while media is playing") },
            { "Integrity.AutoSchedule", ("Weekly", "Integrity", "Integrity scan automated schedule: Off, Daily, Weekly, Monthly") },
            { "Integrity.ScheduledHourUtc", ("3", "Integrity", "Hour of the day in UTC to run scheduled scan") },
            { "Integrity.HashBufferSizeKb", ("1024", "Integrity", "Streaming SHA-256 buffer size in KB") },
            { "Integrity.ProbeDeepDecoding", ("false", "Integrity", "Perform deep decode validation with ffmpeg") },
            { "Integrity.HistoryRetentionDays", ("90", "Integrity", "Number of days to keep verification history") },
            { "System.FirstRunCompleted", ("false", "System", "Whether the first-run onboarding wizard has completed") }
        };

        foreach (var (key, (value, category, description)) in defaultSettings)
        {
            if (!await context.AppSettings.AnyAsync(s => s.Key == key))
            {
                context.AppSettings.Add(new AppSetting
                {
                    Key = key,
                    Value = value,
                    Category = category,
                    Description = description,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
        }

        // Seed UserPreferences
        var defaultPreferences = new Dictionary<string, string>
        {
            { "dashboard_widgets_order", "continue_watching,recently_added,quick_stats,storage_usage,active_jobs,favorite_movies,recent_music" },
            { "dashboard_widgets_visible", "continue_watching:true,recently_added:true,quick_stats:true,storage_usage:true,active_jobs:true,favorite_movies:true,recent_music:true" },
            { "sidebar_collapsed", "false" },
            { "cinema_view_mode", "grid" },
            { "tv_view_mode", "grid" },
            { "gallery_view_mode", "timeline" }
        };

        foreach (var (key, value) in defaultPreferences)
        {
            if (!await context.UserPreferences.AnyAsync(p => p.Key == key))
            {
                context.UserPreferences.Add(new UserPreference
                {
                    Key = key,
                    Value = value,
                    UpdatedAtUtc = DateTime.UtcNow
                });
            }
        }

        await context.SaveChangesAsync();
    }
}

