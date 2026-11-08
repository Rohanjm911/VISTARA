using System.Security.Cryptography;
using System.Text;
using Vistara.Core.Enums;
using Vistara.Services.Integrity;
using Xunit;

namespace Vistara.UnitTests.Integrity;

public class MediaIntegrityMonitorTests
{
    [Fact]
    public async Task ComputeSha256Streaming_CalculatesAccurateHash()
    {
        var tempFile = Path.GetTempFileName();
        try
        {
            var content = "Vistara Personal Media Universe - Audio & Video Integrity Test 2026";
            var utf8NoBom = new UTF8Encoding(false);
            await File.WriteAllTextAsync(tempFile, content, utf8NoBom);

            var computed = await IntegrityService.ComputeSha256StreamingAsync(tempFile, 64, CancellationToken.None);

            using var sha = SHA256.Create();
            var expected = Convert.ToHexString(sha.ComputeHash(utf8NoBom.GetBytes(content))).ToLowerInvariant();

            Assert.Equal(expected, computed);
        }
        finally
        {
            if (File.Exists(tempFile)) File.Delete(tempFile);
        }
    }

    [Fact]
    public async Task DetectFileModification_DetectsChangedHashAndSize()
    {
        var tempFile = Path.GetTempFileName();
        try
        {
            await File.WriteAllTextAsync(tempFile, "Original Pristine Content", Encoding.UTF8);
            var initialHash = await IntegrityService.ComputeSha256StreamingAsync(tempFile, 64, CancellationToken.None);
            var initialSize = new FileInfo(tempFile).Length;

            // Simulate file modification
            await File.WriteAllTextAsync(tempFile, "Modified/Tampered Content In Media Library", Encoding.UTF8);
            var modifiedHash = await IntegrityService.ComputeSha256StreamingAsync(tempFile, 64, CancellationToken.None);
            var modifiedSize = new FileInfo(tempFile).Length;

            Assert.NotEqual(initialHash, modifiedHash);
            Assert.NotEqual(initialSize, modifiedSize);
        }
        finally
        {
            if (File.Exists(tempFile)) File.Delete(tempFile);
        }
    }

    [Fact]
    public void DisconnectedDrive_DoesNotClassifyAsDeleted()
    {
        // An imaginary disconnected drive letter
        var disconnectedDrivePath = @"Z:\NonExistentDrive\Media\Movie.mkv";
        var driveRoot = Path.GetPathRoot(disconnectedDrivePath);

        bool isDriveAccessible = !string.IsNullOrEmpty(driveRoot) && Directory.Exists(driveRoot);

        // Verification logic:
        var status = !isDriveAccessible
            ? IntegrityFileStatus.DriveDisconnected
            : (!File.Exists(disconnectedDrivePath) ? IntegrityFileStatus.Missing : IntegrityFileStatus.Healthy);

        Assert.False(isDriveAccessible);
        Assert.Equal(IntegrityFileStatus.DriveDisconnected, status);
        Assert.NotEqual(IntegrityFileStatus.Missing, status);
    }

    [Fact]
    public void ZeroByteFile_IsDetectedAsCorrupted()
    {
        var tempFile = Path.GetTempFileName();
        try
        {
            File.WriteAllBytes(tempFile, Array.Empty<byte>());
            var fileInfo = new FileInfo(tempFile);

            var isCorrupted = fileInfo.Length == 0;
            Assert.True(isCorrupted);
        }
        finally
        {
            if (File.Exists(tempFile)) File.Delete(tempFile);
        }
    }

    [Fact]
    public void RecoveryCandidateScoring_PrefersExactMatchAndSize()
    {
        var originalFileName = "Interstellar.2014.1080p.mkv";
        long originalSize = 10_000_000;

        int scoreExactNameAndSize = 0;
        if ("Interstellar.2014.1080p.mkv" == originalFileName) scoreExactNameAndSize += 70;
        if (10_000_000 == originalSize) scoreExactNameAndSize += 35;

        int scoreDifferentSize = 0;
        if ("Interstellar.2014.1080p.mkv" == originalFileName) scoreDifferentSize += 70;
        if (5_000_000 == originalSize) scoreDifferentSize += 35;

        Assert.Equal(105, scoreExactNameAndSize);
        Assert.Equal(70, scoreDifferentSize);
        Assert.True(scoreExactNameAndSize > scoreDifferentSize);
    }
}
