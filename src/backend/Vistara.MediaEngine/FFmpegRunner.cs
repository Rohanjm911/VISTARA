using System.Diagnostics;
using System.Text;

namespace Vistara.MediaEngine;

public interface IFFmpegRunner
{
    string FFmpegPath { get; }
    string FFprobePath { get; }
    Task<ProcessExecutionResult> RunFFprobeAsync(string arguments, CancellationToken cancellationToken = default);
    Task<ProcessExecutionResult> RunFFmpegAsync(string arguments, CancellationToken cancellationToken = default);
    Process StartFFmpegStreamingProcess(string arguments);
    Task<bool> TestBinariesAsync();
}

public class ProcessExecutionResult
{
    public int ExitCode { get; set; }
    public string StandardOutput { get; set; } = string.Empty;
    public string StandardError { get; set; } = string.Empty;
    public bool Success => ExitCode == 0;
}

public class FFmpegRunner : IFFmpegRunner
{
    public string FFmpegPath { get; set; } = @"C:\ffmpeg\ffmpeg.exe";
    public string FFprobePath { get; set; } = @"C:\ffmpeg\ffprobe.exe";

    public FFmpegRunner()
    {
        // Check if FFmpeg is in PATH or common paths
        LocateBinaries();
    }

    private void LocateBinaries()
    {
        if (File.Exists(@"C:\ffmpeg\ffmpeg.exe"))
            FFmpegPath = @"C:\ffmpeg\ffmpeg.exe";
        else if (File.Exists(@"C:\ffmpeg\bin\ffmpeg.exe"))
            FFmpegPath = @"C:\ffmpeg\bin\ffmpeg.exe";
        else
            FFmpegPath = "ffmpeg";

        if (File.Exists(@"C:\ffmpeg\ffprobe.exe"))
            FFprobePath = @"C:\ffmpeg\ffprobe.exe";
        else if (File.Exists(@"C:\ffmpeg\bin\ffprobe.exe"))
            FFprobePath = @"C:\ffmpeg\bin\ffprobe.exe";
        else
            FFprobePath = "ffprobe";
    }

    public async Task<ProcessExecutionResult> RunFFprobeAsync(string arguments, CancellationToken cancellationToken = default)
    {
        return await ExecuteProcessAsync(FFprobePath, arguments, cancellationToken);
    }

    public async Task<ProcessExecutionResult> RunFFmpegAsync(string arguments, CancellationToken cancellationToken = default)
    {
        return await ExecuteProcessAsync(FFmpegPath, arguments, cancellationToken);
    }

    public Process StartFFmpegStreamingProcess(string arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = FFmpegPath,
            Arguments = arguments,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        var process = new Process { StartInfo = startInfo };
        process.Start();
        return process;
    }

    public async Task<bool> TestBinariesAsync()
    {
        try
        {
            var ffmpegResult = await ExecuteProcessAsync(FFmpegPath, "-version", CancellationToken.None);
            var ffprobeResult = await ExecuteProcessAsync(FFprobePath, "-version", CancellationToken.None);
            return ffmpegResult.Success && ffprobeResult.Success;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<ProcessExecutionResult> ExecuteProcessAsync(string binaryPath, string arguments, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = binaryPath,
            Arguments = arguments,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        using var process = new Process { StartInfo = startInfo };
        var outputBuilder = new StringBuilder();
        var errorBuilder = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null) outputBuilder.AppendLine(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) errorBuilder.AppendLine(e.Data);
        };

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync(cancellationToken);

            return new ProcessExecutionResult
            {
                ExitCode = process.ExitCode,
                StandardOutput = outputBuilder.ToString(),
                StandardError = errorBuilder.ToString()
            };
        }
        catch (OperationCanceledException)
        {
            try
            {
                if (!process.HasExited)
                    process.Kill(entireProcessTree: true);
            }
            catch { }
            throw;
        }
    }
}

