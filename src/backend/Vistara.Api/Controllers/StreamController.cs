using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Core.Enums;
using Vistara.Infrastructure.Data;
using Vistara.Infrastructure.Security;
using Vistara.MediaEngine;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class StreamController : ControllerBase
{
    private readonly VistaraDbContext _context;
    private readonly IPathSecurityValidator _security;
    private readonly IFFmpegRunner _ffmpeg;
    private readonly ITranscoderService _transcoder;

    public StreamController(
        VistaraDbContext context,
        IPathSecurityValidator security,
        IFFmpegRunner ffmpeg,
        ITranscoderService transcoder)
    {
        _context = context;
        _security = security;
        _ffmpeg = ffmpeg;
        _transcoder = transcoder;
    }

    [HttpGet("{fileId}")]
    [HttpHead("{fileId}")]
    public async Task<IActionResult> StreamMedia(
        Guid fileId,
        [FromQuery] bool remux = false,
        [FromQuery] bool transcode = false,
        [FromQuery] string? format = null,
        [FromQuery] double start = 0,
        [FromQuery] int? audioIndex = null,
        [FromQuery] int audioOffsetMs = 0)
    {
        var mediaFile = await _context.MediaFiles
            .Include(f => f.MediaItem)
            .Include(f => f.Streams)
            .FirstOrDefaultAsync(f => f.Id == fileId);

        if (mediaFile == null || !System.IO.File.Exists(mediaFile.AbsolutePath))
            return NotFound("Media file not found");

        var isAllowed = await _security.IsPathAllowedAsync(mediaFile.AbsolutePath);
        if (!isAllowed) return Forbid("Access denied to requested file path");

        // Allow CORS for Web Audio API inspection & processing
        Response.Headers.Append("Access-Control-Allow-Origin", "*");
        Response.Headers.Append("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        Response.Headers.Append("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Origin");
        Response.Headers.Append("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Type");

        var ext = Path.GetExtension(mediaFile.AbsolutePath).ToLowerInvariant();
        bool isAudio = mediaFile.MediaItem?.Type == MediaType.Track || IsAudioExtension(ext);

        // 1. Audio On-The-Fly Resilient Streaming (Transcode / Remux / Format Conversion)
        if (isAudio && (transcode || remux || format != null || IsUnsupportedBrowserAudio(ext)))
        {
            string outFormat = format?.ToLowerInvariant() ?? "mp3";
            string audioContentType = outFormat switch
            {
                "flac" => "audio/flac",
                "wav" => "audio/wav",
                "aac" => "audio/aac",
                "ogg" or "opus" => "audio/ogg",
                _ => "audio/mpeg"
            };

            Response.ContentType = audioContentType;
            Response.Headers.Append("Accept-Ranges", "none");

            if (HttpMethods.IsHead(Request.Method))
            {
                return Ok();
            }

            string seekArg = start > 0 ? $"-ss {start.ToString(System.Globalization.CultureInfo.InvariantCulture)} " : "";
            string ffmpegArgs = outFormat switch
            {
                "flac" => $"{seekArg}-i \"{mediaFile.AbsolutePath}\" -vn -c:a copy -f flac pipe:1",
                "wav" => $"{seekArg}-i \"{mediaFile.AbsolutePath}\" -vn -c:a pcm_s16le -f wav pipe:1",
                "aac" => $"{seekArg}-i \"{mediaFile.AbsolutePath}\" -vn -c:a aac -b:a 256k -f adts pipe:1",
                _ => $"{seekArg}-i \"{mediaFile.AbsolutePath}\" -vn -c:a libmp3lame -b:a 320k -f mp3 pipe:1"
            };

            var process = _ffmpeg.StartFFmpegStreamingProcess(ffmpegArgs);

            return new FileCallbackResult(audioContentType, async (outputStream, _) =>
            {
                try
                {
                    await process.StandardOutput.BaseStream.CopyToAsync(outputStream);
                }
                catch (Exception)
                {
                    // Client abort or seek during streaming - gracefully ignore
                }
                finally
                {
                    try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
                    process.Dispose();
                }
            });
        }

        // 2. Video On-The-Fly Remuxing or Transcoding
        if (!isAudio && (transcode || remux || audioIndex.HasValue || start > 0 || audioOffsetMs != 0))
        {
            Response.ContentType = "video/mp4";
            Response.Headers.Append("Accept-Ranges", "none");

            if (HttpMethods.IsHead(Request.Method))
            {
                return Ok();
            }

            int? validAudioIndex = null;
            if (audioIndex.HasValue && mediaFile.Streams.Any(s => s.StreamIndex == audioIndex.Value && s.StreamType == MediaStreamType.Audio))
            {
                validAudioIndex = audioIndex.Value;
            }
            else
            {
                var defAudio = mediaFile.Streams.FirstOrDefault(s => s.StreamType == MediaStreamType.Audio && s.IsDefault)
                               ?? mediaFile.Streams.FirstOrDefault(s => s.StreamType == MediaStreamType.Audio);
                validAudioIndex = defAudio?.StreamIndex;
            }

            var args = transcode
                ? await _transcoder.BuildTranscodeStreamArgumentsAsync(mediaFile.AbsolutePath, start, validAudioIndex, audioOffsetMs)
                : _transcoder.BuildRemuxStreamArguments(mediaFile.AbsolutePath, start, validAudioIndex, audioOffsetMs);

            var process = _ffmpeg.StartFFmpegStreamingProcess(args);

            return new FileCallbackResult("video/mp4", async (outputStream, _) =>
            {
                try
                {
                    await process.StandardOutput.BaseStream.CopyToAsync(outputStream);
                }
                catch (Exception)
                {
                    // Client abort or seek during streaming - gracefully ignore
                }
                finally
                {
                    try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
                    process.Dispose();
                }
            });
        }

        // 3. Native Direct Play with full HTTP Range request support
        var contentType = GetContentType(mediaFile.AbsolutePath, mediaFile.MediaItem?.Type);
        return PhysicalFile(mediaFile.AbsolutePath, contentType, enableRangeProcessing: true);
    }

    [HttpGet("{fileId}/hls/{segment}")]
    public async Task<IActionResult> StreamHls(Guid fileId, string segment)
    {
        var mediaFile = await _context.MediaFiles.FirstOrDefaultAsync(f => f.Id == fileId);
        if (mediaFile == null || !System.IO.File.Exists(mediaFile.AbsolutePath))
            return NotFound();

        var hlsDir = _transcoder.GetHlsOutputDir(fileId);
        var targetFile = Path.Combine(hlsDir, segment);

        // If index.m3u8 is requested and doesn't exist yet, start HLS transcoding
        if (segment.EndsWith(".m3u8") && !System.IO.File.Exists(targetFile))
        {
            var args = await _transcoder.BuildTranscodeHlsArgumentsAsync(mediaFile.AbsolutePath, hlsDir);
            _ffmpeg.StartFFmpegStreamingProcess(args);

            // Wait up to 7 seconds for the master playlist to be generated
            int attempts = 0;
            while (!System.IO.File.Exists(targetFile) && attempts < 70)
            {
                await Task.Delay(100);
                attempts++;
            }
        }

        if (!System.IO.File.Exists(targetFile))
            return NotFound("HLS segment not ready yet");

        var mimeType = segment.EndsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/MP2T";
        return PhysicalFile(targetFile, mimeType);
    }

    private static string GetContentType(string filePath, MediaType? mediaType)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        return ext switch
        {
            ".mp4" => "video/mp4",
            ".mkv" => "video/x-matroska",
            ".webm" => "video/webm",
            ".mov" => "video/quicktime",
            ".avi" => "video/x-msvideo",
            ".ts" => "video/mp2t",
            ".mp3" => "audio/mpeg",
            ".flac" => "audio/flac",
            ".wav" => "audio/wav",
            ".aac" => "audio/aac",
            ".m4a" => "audio/mp4",
            ".ogg" or ".opus" => "audio/ogg",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => mediaType == MediaType.Track ? "audio/mpeg" : (mediaType == MediaType.Photo ? "image/jpeg" : "video/mp4")
        };
    }

    private static bool IsAudioExtension(string ext) =>
        ext is ".flac" or ".mp3" or ".wav" or ".aac" or ".m4a" or ".ogg" or ".opus" or ".wma" or ".alac" or ".aiff" or ".aif" or ".ape" or ".dsf" or ".dff" or ".mka";

    private static bool IsUnsupportedBrowserAudio(string ext) =>
        ext is ".wma" or ".alac" or ".aiff" or ".aif" or ".ape" or ".dsf" or ".dff";
}

public class FileCallbackResult : ActionResult
{
    private readonly string _contentType;
    private readonly Func<Stream, ActionContext, Task> _callback;

    public FileCallbackResult(string contentType, Func<Stream, ActionContext, Task> callback)
    {
        _contentType = contentType;
        _callback = callback;
    }

    public override async Task ExecuteResultAsync(ActionContext context)
    {
        context.HttpContext.Response.ContentType = _contentType;
        await _callback(context.HttpContext.Response.Body, context);
    }
}

