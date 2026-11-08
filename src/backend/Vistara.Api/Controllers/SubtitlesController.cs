using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.DTOs;
using Vistara.Infrastructure.Data;
using Vistara.MediaEngine;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SubtitlesController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly ISubtitleService _subtitles;

    public SubtitlesController(VistaraDbContext context, ISubtitleService subtitles)
    {
        _context = context;
        _subtitles = subtitles;
    }

    [HttpGet("{streamId:guid}")]
    public async Task<IActionResult> GetSubtitle(Guid streamId, CancellationToken cancellationToken)
    {
        var stream = await _context.MediaStreams
            .Include(s => s.MediaFile)
            .FirstOrDefaultAsync(s => s.Id == streamId, cancellationToken);

        if (stream == null || stream.MediaFile == null || !System.IO.File.Exists(stream.MediaFile.AbsolutePath))
            return NotFound("Subtitle stream not found");

        var vttPath = await _subtitles.ExtractOrConvertSubtitleToVttAsync(stream.MediaFile.AbsolutePath, stream.StreamIndex, cancellationToken);
        if (vttPath == null || !System.IO.File.Exists(vttPath))
            return NotFound("Failed extracting subtitle");

        return PhysicalFile(vttPath, "text/vtt; charset=utf-8");
    }

    [HttpGet("file/{mediaFileId:guid}/{streamIndex:int}")]
    public async Task<IActionResult> GetSubtitleByFile(Guid mediaFileId, int streamIndex, CancellationToken cancellationToken)
    {
        var mediaFile = await _context.MediaFiles.FirstOrDefaultAsync(f => f.Id == mediaFileId, cancellationToken);
        if (mediaFile == null || !System.IO.File.Exists(mediaFile.AbsolutePath))
            return NotFound("Media file not found");

        var vttPath = await _subtitles.ExtractOrConvertSubtitleToVttAsync(mediaFile.AbsolutePath, streamIndex, cancellationToken);
        if (vttPath == null || !System.IO.File.Exists(vttPath))
            return NotFound("Failed extracting subtitle");

        return PhysicalFile(vttPath, "text/vtt; charset=utf-8");
    }

    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<OnlineSubtitleResultDto>>>> Search(
        [FromQuery] string? query,
        [FromQuery] string? imdbId,
        [FromQuery] string type = "movie",
        [FromQuery] int? season = null,
        [FromQuery] int? episode = null,
        [FromQuery] string? language = null,
        CancellationToken cancellationToken = default)
    {
        var results = await _subtitles.SearchOnlineSubtitlesAsync(
            query,
            imdbId,
            type,
            season,
            episode,
            language,
            cancellationToken);

        return Ok(ApiResponse<List<OnlineSubtitleResultDto>>.Ok(results));
    }

    [HttpPost("download")]
    public async Task<ActionResult<ApiResponse<DownloadOnlineSubtitleResponse>>> Download(
        [FromBody] DownloadOnlineSubtitleRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.DownloadUrl))
            return BadRequest(ApiResponse<DownloadOnlineSubtitleResponse>.Fail("DownloadUrl is required"));

        var result = await _subtitles.DownloadAndConvertOnlineSubtitleAsync(request, cancellationToken);
        if (result == null)
            return StatusCode(502, ApiResponse<DownloadOnlineSubtitleResponse>.Fail("Failed to download or convert subtitle"));

        return Ok(ApiResponse<DownloadOnlineSubtitleResponse>.Ok(result));
    }

    [HttpGet("online/{cacheFileName}")]
    public IActionResult GetCachedSubtitle(string cacheFileName)
    {
        var path = _subtitles.GetCachedSubtitlePath(cacheFileName);
        if (path == null)
            return NotFound("Cached subtitle not found");

        return PhysicalFile(path, "text/vtt; charset=utf-8");
    }
}


