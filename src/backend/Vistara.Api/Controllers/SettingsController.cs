using Microsoft.AspNetCore.Mvc;
using Vistara.Core.DTOs;
using Vistara.Services.Settings;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settings;

    public SettingsController(ISettingsService settings)
    {
        _settings = settings;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var settings = await _settings.GetAllSettingsAsync();
        return Ok(ApiResponse<Dictionary<string, string>>.Ok(settings));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateSetting([FromBody] UpdateSettingRequest request)
    {
        await _settings.UpdateSettingAsync(request.Key, request.Value);
        return Ok(ApiResponse<bool>.Ok(true, $"Updated {request.Key}"));
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> GetPreferences()
    {
        var prefs = await _settings.GetUserPreferencesAsync();
        return Ok(ApiResponse<Dictionary<string, string>>.Ok(prefs));
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreference([FromBody] UpdateSettingRequest request)
    {
        await _settings.UpdateUserPreferenceAsync(request.Key, request.Value);
        return Ok(ApiResponse<bool>.Ok(true, $"Updated preference {request.Key}"));
    }

    [HttpPost("test-ffmpeg")]
    public async Task<IActionResult> TestFFmpeg([FromBody] TestFFmpegRequest? request)
    {
        var success = await _settings.TestFFmpegAsync(request?.FFmpegPath, request?.FFprobePath);
        return Ok(ApiResponse<bool>.Ok(success, success ? "FFmpeg and FFprobe verified successfully" : "FFmpeg verification failed"));
    }

    [HttpPost("reset")]
    public async Task<IActionResult> ResetToDefaults()
    {
        await _settings.ResetToDefaultsAsync();
        return Ok(ApiResponse<bool>.Ok(true, "Settings reset to defaults"));
    }
}

public class UpdateSettingRequest
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}

public class TestFFmpegRequest
{
    public string? FFmpegPath { get; set; }
    public string? FFprobePath { get; set; }
}

