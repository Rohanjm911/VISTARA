using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Vistara.Api.Hubs;
using Vistara.Core.DTOs;
using Vistara.Services.Playback;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class PlaybackController : ControllerBase
{
    private readonly IPlaybackService _playback;
    private readonly IHubContext<VistaraHub, IVistaraClient> _hubContext;

    public PlaybackController(IPlaybackService playback, IHubContext<VistaraHub, IVistaraClient> hubContext)
    {
        _playback = playback;
        _hubContext = hubContext;
    }

    [HttpPost("start")]
    public async Task<IActionResult> StartPlayback([FromBody] PlaybackStartRequest request)
    {
        var info = await _playback.PreparePlaybackAsync(request.MediaFileId, request.ClientId);
        return Ok(ApiResponse<MediaFilePlaybackInfoDto>.Ok(info));
    }

    [HttpPost("progress")]
    public async Task<IActionResult> UpdateProgress([FromBody] PlaybackProgressRequest request)
    {
        var dto = await _playback.UpdateProgressAsync(request);
        await _hubContext.Clients.All.PlaybackProgressUpdated(dto);
        return Ok(ApiResponse<PlaybackProgressDto>.Ok(dto));
    }

    [HttpPost("stop")]
    public async Task<IActionResult> StopPlayback([FromBody] PlaybackStopRequest request)
    {
        await _playback.StopPlaybackAsync(request.MediaFileId, request.ClientId);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpGet("progress/{mediaItemId}")]
    public async Task<IActionResult> GetProgress(Guid mediaItemId)
    {
        var progress = await _playback.GetProgressAsync(mediaItemId);
        return Ok(ApiResponse<PlaybackProgressDto?>.Ok(progress));
    }

    [HttpDelete("progress/{mediaItemId}")]
    public async Task<IActionResult> DeleteProgress(Guid mediaItemId)
    {
        var deleted = await _playback.DeleteProgressAsync(mediaItemId);
        return Ok(ApiResponse<bool>.Ok(deleted));
    }
}

public class PlaybackStopRequest
{
    public Guid MediaFileId { get; set; }
    public string? ClientId { get; set; }
}

