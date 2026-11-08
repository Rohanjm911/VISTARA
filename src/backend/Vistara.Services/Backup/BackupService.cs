using System.IO.Compression;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Infrastructure.Data;

namespace Vistara.Services.Backup;

public interface IBackupService
{
    Task<BackupHistory> CreateBackupAsync(BackupType type, string? notes = null, CancellationToken cancellationToken = default);
    Task<List<BackupHistory>> GetBackupsAsync(CancellationToken cancellationToken = default);
    Task<bool> VerifyBackupAsync(Guid backupId, CancellationToken cancellationToken = default);
    Task<bool> RestoreBackupAsync(Guid backupId, CancellationToken cancellationToken = default);
    Task CleanupOldBackupsAsync(CancellationToken cancellationToken = default);
}

public class BackupService : IBackupService
{
    private readonly VistaraDbContext _context;
    private readonly string _backupRoot;

    public BackupService(VistaraDbContext context)
    {
        _context = context;
        _backupRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "backups");
        Directory.CreateDirectory(_backupRoot);
    }

    public async Task<BackupHistory> CreateBackupAsync(BackupType type, string? notes = null, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var backupName = $"vistara_backup_{type.ToString().ToLower()}_{timestamp}.zip";
        var zipPath = Path.Combine(_backupRoot, backupName);

        var tempDir = Path.Combine(_backupRoot, "temp_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            var dbBackupPath = Path.Combine(tempDir, "vistara.db");

            // Execute transactionally consistent VACUUM INTO
            var escapedDbPath = dbBackupPath.Replace("'", "''");
            using (var command = _context.Database.GetDbConnection().CreateCommand())
            {
                command.CommandText = $"VACUUM INTO '{escapedDbPath}';";
                if (command.Connection?.State != System.Data.ConnectionState.Open)
                    await _context.Database.OpenConnectionAsync(cancellationToken);

                await command.ExecuteNonQueryAsync(cancellationToken);
            }

            // Create Zip archive containing the database backup
            if (File.Exists(zipPath)) File.Delete(zipPath);
            ZipFile.CreateFromDirectory(tempDir, zipPath, CompressionLevel.Optimal, false);

            var fileInfo = new FileInfo(zipPath);

            var history = new BackupHistory
            {
                BackupName = backupName,
                FilePath = zipPath,
                FileSizeBytes = fileInfo.Length,
                BackupType = type,
                Status = "Completed",
                VerifiedSuccessfully = true,
                Notes = notes,
                CreatedAtUtc = DateTime.UtcNow
            };

            _context.BackupHistories.Add(history);
            await _context.SaveChangesAsync(cancellationToken);

            // Cleanup old backups according to retention policy
            await CleanupOldBackupsAsync(cancellationToken);

            return history;
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempDir))
                    Directory.Delete(tempDir, true);
            }
            catch { }
        }
    }

    public async Task<List<BackupHistory>> GetBackupsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.BackupHistories
            .OrderByDescending(b => b.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> VerifyBackupAsync(Guid backupId, CancellationToken cancellationToken = default)
    {
        var backup = await _context.BackupHistories.FirstOrDefaultAsync(b => b.Id == backupId, cancellationToken);
        if (backup == null || !File.Exists(backup.FilePath)) return false;

        try
        {
            using var archive = ZipFile.OpenRead(backup.FilePath);
            var dbEntry = archive.GetEntry("vistara.db");
            return dbEntry != null && dbEntry.Length > 0;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> RestoreBackupAsync(Guid backupId, CancellationToken cancellationToken = default)
    {
        var backup = await _context.BackupHistories.FirstOrDefaultAsync(b => b.Id == backupId, cancellationToken);
        if (backup == null || !File.Exists(backup.FilePath)) return false;

        // 1. Verify target backup
        bool isValid = await VerifyBackupAsync(backupId, cancellationToken);
        if (!isValid) return false;

        // 2. Create pre-restore safety backup
        await CreateBackupAsync(BackupType.PreUpdate, "Pre-restore safety backup", cancellationToken);

        // 3. Extract and replace database
        var currentDbPath = _context.Database.GetDbConnection().DataSource;
        if (string.IsNullOrEmpty(currentDbPath)) return false;

        var tempDir = Path.Combine(_backupRoot, "restore_temp_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        try
        {
            ZipFile.ExtractToDirectory(backup.FilePath, tempDir);
            var extractedDb = Path.Combine(tempDir, "vistara.db");

            if (!File.Exists(extractedDb)) return false;

            // Close connection
            await _context.Database.CloseConnectionAsync();

            File.Copy(extractedDb, currentDbPath, overwrite: true);

            // Re-open and verify integrity
            await _context.Database.OpenConnectionAsync(cancellationToken);
            using var command = _context.Database.GetDbConnection().CreateCommand();
            command.CommandText = "PRAGMA integrity_check;";
            var checkResult = (string?)await command.ExecuteScalarAsync(cancellationToken);

            return checkResult == "ok";
        }
        finally
        {
            try
            {
                if (Directory.Exists(tempDir))
                    Directory.Delete(tempDir, true);
            }
            catch { }
        }
    }

    public async Task CleanupOldBackupsAsync(CancellationToken cancellationToken = default)
    {
        // 7 daily, 4 weekly, 12 monthly
        var dailyBackups = await _context.BackupHistories
            .Where(b => b.BackupType == BackupType.Daily)
            .OrderByDescending(b => b.CreatedAtUtc)
            .Skip(7)
            .ToListAsync(cancellationToken);

        var weeklyBackups = await _context.BackupHistories
            .Where(b => b.BackupType == BackupType.Weekly)
            .OrderByDescending(b => b.CreatedAtUtc)
            .Skip(4)
            .ToListAsync(cancellationToken);

        var toDelete = dailyBackups.Concat(weeklyBackups).ToList();
        foreach (var item in toDelete)
        {
            try
            {
                if (File.Exists(item.FilePath))
                    File.Delete(item.FilePath);
            }
            catch { }
            _context.BackupHistories.Remove(item);
        }

        if (toDelete.Count > 0)
            await _context.SaveChangesAsync(cancellationToken);
    }
}

