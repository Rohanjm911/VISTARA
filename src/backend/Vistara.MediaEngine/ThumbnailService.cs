namespace Vistara.MediaEngine;

public interface IThumbnailService
{
    Task<string?> GenerateVideoThumbnailAsync(string videoPath, double positionSeconds, int width = 480, CancellationToken cancellationToken = default);
    Task<string?> ExtractAudioCoverArtAsync(string audioPath, CancellationToken cancellationToken = default);
    Task<string?> GeneratePhotoThumbnailAsync(string photoPath, int maxWidth = 480, CancellationToken cancellationToken = default);
    Task<string?> GenerateSpriteSheetAsync(string videoPath, double durationSeconds, CancellationToken cancellationToken = default);
}

public class ThumbnailService : IThumbnailService
{
    private readonly IFFmpegRunner _runner;
    private readonly string _cacheDirectory;

    public ThumbnailService(IFFmpegRunner runner)
    {
        _runner = runner;
        _cacheDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "cache", "thumbnails");
        Directory.CreateDirectory(_cacheDirectory);
    }

    public async Task<string?> GenerateVideoThumbnailAsync(string videoPath, double positionSeconds, int width = 480, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(videoPath)) return null;

        var hash = (videoPath + positionSeconds).GetHashCode().ToString("X8");
        var outputPath = Path.Combine(_cacheDirectory, $"vid_{hash}_{width}.jpg");

        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
            return outputPath;

        var escapedIn = videoPath.Replace("\"", "\\\"");
        var escapedOut = outputPath.Replace("\"", "\\\"");

        var args = $"-ss {positionSeconds:F2} -i \"{escapedIn}\" -vframes 1 -q:v 2 -vf \"scale={width}:-1\" -y \"{escapedOut}\"";
        var result = await _runner.RunFFmpegAsync(args, cancellationToken);

        return (result.Success && File.Exists(outputPath)) ? outputPath : null;
    }

    public async Task<string?> ExtractAudioCoverArtAsync(string audioPath, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(audioPath)) return null;

        var hash = audioPath.GetHashCode().ToString("X8");
        var outputPath = Path.Combine(_cacheDirectory, $"art_{hash}.jpg");

        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
            return outputPath;

        var escapedIn = audioPath.Replace("\"", "\\\"");
        var escapedOut = outputPath.Replace("\"", "\\\"");

        var args = $"-i \"{escapedIn}\" -an -vcodec copy -y \"{escapedOut}\"";
        var result = await _runner.RunFFmpegAsync(args, cancellationToken);

        return (result.Success && File.Exists(outputPath) && new FileInfo(outputPath).Length > 0) ? outputPath : null;
    }

    public async Task<string?> GeneratePhotoThumbnailAsync(string photoPath, int maxWidth = 480, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(photoPath)) return null;

        var hash = photoPath.GetHashCode().ToString("X8");
        var outputPath = Path.Combine(_cacheDirectory, $"photo_{hash}_{maxWidth}.webp");

        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
            return outputPath;

        var escapedIn = photoPath.Replace("\"", "\\\"");
        var escapedOut = outputPath.Replace("\"", "\\\"");

        var args = $"-i \"{escapedIn}\" -vf \"scale='min({maxWidth},iw)':-1\" -q:v 80 -y \"{escapedOut}\"";
        var result = await _runner.RunFFmpegAsync(args, cancellationToken);

        return (result.Success && File.Exists(outputPath)) ? outputPath : null;
    }

    public async Task<string?> GenerateSpriteSheetAsync(string videoPath, double durationSeconds, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(videoPath) || durationSeconds <= 0) return null;

        var hash = videoPath.GetHashCode().ToString("X8");
        var outputPath = Path.Combine(_cacheDirectory, $"sprites_{hash}.jpg");

        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
            return outputPath;

        // Take 1 frame every 10 seconds or total 50 frames
        int interval = Math.Max(5, (int)(durationSeconds / 50));
        var escapedIn = videoPath.Replace("\"", "\\\"");
        var escapedOut = outputPath.Replace("\"", "\\\"");

        var args = $"-i \"{escapedIn}\" -vf \"fps=1/{interval},scale=160:90,tile=10x5\" -y \"{escapedOut}\"";
        var result = await _runner.RunFFmpegAsync(args, cancellationToken);

        return (result.Success && File.Exists(outputPath)) ? outputPath : null;
    }
}

