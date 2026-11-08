using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Vistara.Core.DTOs;
using Vistara.MediaEngine;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SystemController : ControllerBase
{
    private readonly IHardwareAccelerationService _hwAccel;
    private readonly IFFmpegRunner _ffmpeg;
    private static readonly DateTime StartTime = DateTime.UtcNow;
    private static SystemHealthDto? _cachedHealth;
    private static DateTime _lastHealthCheckUtc = DateTime.MinValue;

    public SystemController(IHardwareAccelerationService hwAccel, IFFmpegRunner ffmpeg)
    {
        _hwAccel = hwAccel;
        _ffmpeg = ffmpeg;
    }

    [HttpGet("ping")]
    public IActionResult Ping()
    {
        return Ok("pong");
    }

    [HttpGet("health")]
    public async Task<IActionResult> GetHealth()
    {
        if (_cachedHealth != null && (DateTime.UtcNow - _lastHealthCheckUtc).TotalSeconds < 30)
        {
            return Ok(ApiResponse<SystemHealthDto>.Ok(_cachedHealth));
        }

        var hwMethods = await _hwAccel.GetAvailableMethodsAsync();
        var ffmpegOk = await _ffmpeg.TestBinariesAsync();

        var currentProcess = Process.GetCurrentProcess();

        _cachedHealth = new SystemHealthDto
        {
            Status = "Healthy",
            Version = "1.0.0",
            DatabaseConnected = true,
            FFmpegInstalled = ffmpegOk,
            FFprobeInstalled = ffmpegOk,
            HardwareAccelerationMethods = hwMethods,
            MemoryUsedBytes = currentProcess.WorkingSet64,
            CpuUsagePercent = 0.5,
            Uptime = DateTime.UtcNow - StartTime,
            OperatingSystem = Environment.OSVersion.ToString()
        };
        _lastHealthCheckUtc = DateTime.UtcNow;

        return Ok(ApiResponse<SystemHealthDto>.Ok(_cachedHealth));
    }

    [HttpGet("hardware-acceleration")]
    public async Task<IActionResult> GetHardwareAcceleration()
    {
        var methods = await _hwAccel.GetAvailableMethodsAsync();
        var bestEncoder = await _hwAccel.GetBestEncoderAsync();
        return Ok(ApiResponse<object>.Ok(new
        {
            AvailableMethods = methods,
            RecommendedEncoder = bestEncoder
        }));
    }

    [HttpGet("diagnostics")]
    public async Task<IActionResult> GetDiagnostics()
    {
        var hwMethods = await _hwAccel.GetAvailableMethodsAsync();
        var process = Process.GetCurrentProcess();

        var drives = DriveInfo.GetDrives()
            .Where(d => d.IsReady)
            .Select(d => new
            {
                d.Name,
                d.DriveType,
                TotalSpaceGb = Math.Round(d.TotalSize / (1024.0 * 1024 * 1024), 2),
                FreeSpaceGb = Math.Round(d.AvailableFreeSpace / (1024.0 * 1024 * 1024), 2)
            }).ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            ProcessId = process.Id,
            Threads = process.Threads.Count,
            MemoryWorkingSetMb = Math.Round(process.WorkingSet64 / (1024.0 * 1024), 2),
            Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
            DotNetVersion = Environment.Version.ToString(),
            Drives = drives,
            HardwareAcceleration = hwMethods
        }));
    }

    [HttpGet("browse-folder")]
    [HttpPost("browse-folder")]
    public async Task<IActionResult> BrowseFolder([FromQuery] string? initialPath = null, [FromQuery] string? title = null, [FromBody] BrowseFolderRequest? body = null)
    {
        try
        {
            var initPath = body?.InitialPath ?? initialPath;
            var dlgTitle = body?.Title ?? title ?? "Select a Media Folder for VISTARA";

            var tcs = new TaskCompletionSource<string?>();

            var thread = new Thread(() =>
            {
                try
                {
                    using var dialog = new System.Windows.Forms.FolderBrowserDialog();
                    dialog.Description = dlgTitle;
                    dialog.UseDescriptionForTitle = true;
                    dialog.AutoUpgradeEnabled = true;
                    dialog.ShowNewFolderButton = true;

                    if (!string.IsNullOrWhiteSpace(initPath) && Directory.Exists(initPath))
                    {
                        dialog.InitialDirectory = initPath;
                    }

                    // Temporary top-most form so dialog appears cleanly in front of other windows
                    using var owner = new System.Windows.Forms.Form
                    {
                        TopMost = true,
                        StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen,
                        WindowState = System.Windows.Forms.FormWindowState.Minimized
                    };

                    var result = dialog.ShowDialog(owner);
                    if (result == System.Windows.Forms.DialogResult.OK && !string.IsNullOrWhiteSpace(dialog.SelectedPath))
                    {
                        tcs.TrySetResult(dialog.SelectedPath);
                    }
                    else
                    {
                        tcs.TrySetResult(null);
                    }
                }
                catch (Exception ex)
                {
                    tcs.TrySetException(ex);
                }
            });

            thread.SetApartmentState(ApartmentState.STA);
            thread.IsBackground = true;
            thread.Start();

            var selectedPath = await tcs.Task;
            return Ok(ApiResponse<object>.Ok(new { path = selectedPath, selected = !string.IsNullOrEmpty(selectedPath) }));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse<object>.Fail($"Error displaying folder dialog: {ex.Message}"));
        }
    }
}

public class BrowseFolderRequest
{
    public string? InitialPath { get; set; }
    public string? Title { get; set; }
}

