using Microsoft.EntityFrameworkCore;
using Vistara.Infrastructure.Data;

namespace Vistara.Infrastructure.Security;

public interface IPathSecurityValidator
{
    Task<bool> IsPathAllowedAsync(string path, CancellationToken cancellationToken = default);
    Task<string> ValidateAndNormalizePathAsync(string path, CancellationToken cancellationToken = default);
    bool IsPathWithinRoot(string candidatePath, string allowedRoot);
}

public class PathSecurityValidator : IPathSecurityValidator
{
    private readonly VistaraDbContext _dbContext;

    public PathSecurityValidator(VistaraDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> IsPathAllowedAsync(string path, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;

        string normalizedCandidate;
        try
        {
            normalizedCandidate = Path.GetFullPath(path);
        }
        catch
        {
            return false;
        }

        var allowedFolders = await _dbContext.LibraryFolders
            .Select(f => f.Path)
            .ToListAsync(cancellationToken);

        // Also allow local Vistara AppData directories (for artwork, thumbnails, backups)
        var appDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara");
        allowedFolders.Add(appDataDir);

        foreach (var allowed in allowedFolders)
        {
            if (string.IsNullOrWhiteSpace(allowed))
                continue;

            if (IsPathWithinRoot(normalizedCandidate, allowed))
                return true;
        }

        return false;
    }

    public async Task<string> ValidateAndNormalizePathAsync(string path, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Path cannot be empty", nameof(path));

        string normalized;
        try
        {
            normalized = Path.GetFullPath(path);
        }
        catch (Exception ex)
        {
            throw new UnauthorizedAccessException($"Invalid path format: {ex.Message}");
        }

        bool isAllowed = await IsPathAllowedAsync(normalized, cancellationToken);
        if (!isAllowed)
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is forbidden. Path must be inside a registered library folder or Vistara data directory.");
        }

        return normalized;
    }

    public bool IsPathWithinRoot(string candidatePath, string allowedRoot)
    {
        try
        {
            var fullCandidate = Path.GetFullPath(candidatePath)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var fullRoot = Path.GetFullPath(allowedRoot)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

            return fullCandidate.Equals(fullRoot, StringComparison.OrdinalIgnoreCase) ||
                   fullCandidate.StartsWith(fullRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}

