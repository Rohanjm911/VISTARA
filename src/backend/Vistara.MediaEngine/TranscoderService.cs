using Vistara.Core.Enums;
using Vistara.Core.Models;

namespace Vistara.MediaEngine;

public interface ITranscoderService
{
    PlaybackPipelineMode DeterminePlaybackMode(MediaFile mediaFile);
    string BuildRemuxStreamArguments(string inputPath, double startPositionSeconds = 0, int? audioStreamIndex = null, int audioOffsetMs = 0);
    Task<string> BuildTranscodeStreamArgumentsAsync(string inputPath, double startPositionSeconds = 0, int? audioStreamIndex = null, int audioOffsetMs = 0);
    Task<string> BuildTranscodeHlsArgumentsAsync(string inputPath, string hlsOutputDir, double startPositionSeconds = 0);
    string GetHlsOutputDir(Guid mediaFileId);
}

public class TranscoderService : ITranscoderService
{
    private readonly IHardwareAccelerationService _hwAccel;
    private readonly string _hlsBaseDirectory;

    private static readonly HashSet<string> DirectPlayContainers = new(StringComparer.OrdinalIgnoreCase)
    {
        "mp4", "m4v", "webm", "mp3", "wav", "ogg", "aac", "flac"
    };

    private static readonly HashSet<string> DirectPlayVideoCodecs = new(StringComparer.OrdinalIgnoreCase)
    {
        "h264", "av1", "vp9", "vp8"
    };

    private static readonly HashSet<string> DirectPlayAudioCodecs = new(StringComparer.OrdinalIgnoreCase)
    {
        "aac", "mp3", "opus", "vorbis", "flac"
    };

    public TranscoderService(IHardwareAccelerationService hwAccel)
    {
        _hwAccel = hwAccel;
        _hlsBaseDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "cache", "hls");
        Directory.CreateDirectory(_hlsBaseDirectory);
    }

    public string GetHlsOutputDir(Guid mediaFileId)
    {
        var dir = Path.Combine(_hlsBaseDirectory, mediaFileId.ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    public PlaybackPipelineMode DeterminePlaybackMode(MediaFile mediaFile)
    {
        var ext = Path.GetExtension(mediaFile.AbsolutePath).TrimStart('.').ToLowerInvariant();
        var videoCodec = (mediaFile.VideoCodec ?? "").ToLowerInvariant();
        var audioCodec = (mediaFile.AudioCodec ?? "").ToLowerInvariant();

        // MKV container is NOT supported natively by browser HTML5 <video> elements
        bool isMkv = ext == "mkv" || (mediaFile.ContainerFormat != null && mediaFile.ContainerFormat.Contains("matroska"));

        bool containerNative = !isMkv && (DirectPlayContainers.Contains(ext) ||
                               (mediaFile.ContainerFormat != null &&
                                (mediaFile.ContainerFormat.Equals("mp4", StringComparison.OrdinalIgnoreCase) ||
                                 (mediaFile.ContainerFormat.Equals("webm", StringComparison.OrdinalIgnoreCase) && ext == "webm"))));

        bool videoNative = string.IsNullOrEmpty(videoCodec) || DirectPlayVideoCodecs.Contains(videoCodec);
        bool audioNative = string.IsNullOrEmpty(audioCodec) || DirectPlayAudioCodecs.Contains(audioCodec);

        if (containerNative && videoNative && audioNative)
        {
            return PlaybackPipelineMode.DirectPlay;
        }

        if (videoNative)
        {
            // Video is already browser-compatible (H.264/AV1/VP9):
            // Remux on-the-fly to fragmented MP4 (DirectStream) with 0% CPU video copy + AAC audio!
            return PlaybackPipelineMode.DirectStream;
        }

        return PlaybackPipelineMode.Transcode;
    }

    public string BuildRemuxStreamArguments(string inputPath, double startPositionSeconds = 0, int? audioStreamIndex = null, int audioOffsetMs = 0)
    {
        var escapedIn = inputPath.Replace("\"", "\\\"");
        
        // Fast seek to nearest keyframe for both video and audio together to prevent A/V drift
        var ss = startPositionSeconds > 0 
            ? $"-noaccurate_seek -ss {startPositionSeconds.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)} " 
            : "";

        // Explicitly map primary video and requested/default audio stream
        var mapArgs = audioStreamIndex.HasValue
            ? $"-map 0:v:0 -map 0:{audioStreamIndex.Value} "
            : "-map 0:v:0 -map 0:a:0? ";

        // Build audio filter chain for synchronization & optional delay/advance offset
        string audioFilter;
        if (audioOffsetMs > 0)
        {
            // Delay audio by N ms
            audioFilter = $"-af \"adelay={audioOffsetMs}|{audioOffsetMs},aresample=async=1\" ";
        }
        else if (audioOffsetMs < 0)
        {
            // Advance audio by trimming start
            var trimSec = (Math.Abs(audioOffsetMs) / 1000.0).ToString("F3", System.Globalization.CultureInfo.InvariantCulture);
            audioFilter = $"-af \"atrim=start={trimSec},asetpts=PTS-STARTPTS,aresample=async=1\" ";
        }
        else
        {
            // Enforce audio sample synchronization with video timestamps without overriding initial PTS
            audioFilter = "-af \"aresample=async=1\" ";
        }

        // Remux to fragmented MP4: copy video (0% CPU), encode audio to AAC stereo,
        // avoid negative ts make zero for seamless HTML5 MSE decoding,
        // and discard corrupt packets while generating continuous presentation timestamps
        return $"{ss}-i \"{escapedIn}\" {mapArgs}-c:v copy -c:a aac -b:a 256k -ac 2 {audioFilter}-sn -avoid_negative_ts make_zero -fflags +genpts+discardcorrupt -max_muxing_queue_size 2048 -movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1";
    }

    public async Task<string> BuildTranscodeStreamArgumentsAsync(string inputPath, double startPositionSeconds = 0, int? audioStreamIndex = null, int audioOffsetMs = 0)
    {
        var escapedIn = inputPath.Replace("\"", "\\\"");
        var ss = startPositionSeconds > 0
            ? $"-ss {startPositionSeconds.ToString("F3", System.Globalization.CultureInfo.InvariantCulture)} "
            : "";

        var mapArgs = audioStreamIndex.HasValue
            ? $"-map 0:v:0 -map 0:{audioStreamIndex.Value} "
            : "-map 0:v:0 -map 0:a:0? ";

        string audioFilter;
        if (audioOffsetMs > 0)
        {
            audioFilter = $"-af \"adelay={audioOffsetMs}|{audioOffsetMs},aresample=async=1\" ";
        }
        else if (audioOffsetMs < 0)
        {
            var trimSec = (Math.Abs(audioOffsetMs) / 1000.0).ToString("F3", System.Globalization.CultureInfo.InvariantCulture);
            audioFilter = $"-af \"atrim=start={trimSec},asetpts=PTS-STARTPTS,aresample=async=1\" ";
        }
        else
        {
            audioFilter = "-af \"aresample=async=1\" ";
        }

        var hwFlags = await _hwAccel.GetFFmpegAccelerationFlagsAsync();
        var encoder = await _hwAccel.GetBestEncoderAsync("h264") ?? "libx264";
        string preset = encoder.Contains("nvenc") ? "-preset p2" : (encoder.Contains("qsv") ? "-preset fast" : "-preset veryfast");

        return $"{hwFlags} {ss}-i \"{escapedIn}\" {mapArgs}-c:v {encoder} {preset} -pix_fmt yuv420p -b:v 4200k -maxrate 5800k -bufsize 8500k -c:a aac -b:a 192k -ac 2 {audioFilter}-sn -avoid_negative_ts make_zero -fflags +genpts+discardcorrupt -max_muxing_queue_size 2048 -movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1";
    }

    public async Task<string> BuildTranscodeHlsArgumentsAsync(string inputPath, string hlsOutputDir, double startPositionSeconds = 0)
    {
        var escapedIn = inputPath.Replace("\"", "\\\"");
        var playlistPath = Path.Combine(hlsOutputDir, "index.m3u8").Replace("\"", "\\\"");
        var segmentPattern = Path.Combine(hlsOutputDir, "segment_%03d.ts").Replace("\"", "\\\"");

        var ss = startPositionSeconds > 0 ? $"-ss {startPositionSeconds.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)} " : "";
        var hwFlags = await _hwAccel.GetFFmpegAccelerationFlagsAsync();
        var encoder = await _hwAccel.GetBestEncoderAsync("h264") ?? "libx264";
        string preset = encoder.Contains("nvenc") ? "-preset p2" : (encoder.Contains("qsv") ? "-preset fast" : "-preset veryfast");

        return $"{hwFlags} {ss}-i \"{escapedIn}\" " +
               $"-map 0:v:0 -map 0:a:0? -c:v {encoder} {preset} -pix_fmt yuv420p -b:v 4500k -maxrate 6000k -bufsize 9000k " +
               $"-c:a aac -b:a 192k -ac 2 " +
               $"-f hls -hls_time 4 -hls_list_size 0 " +
               $"-hls_segment_filename \"{segmentPattern}\" \"{playlistPath}\"";
    }
}

