using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Vistara.Core.Enums;
using Vistara.Core.Models;

namespace Vistara.MediaEngine;

public class MediaProbeResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string ContainerFormat { get; set; } = string.Empty;
    public double DurationSeconds { get; set; }
    public long FileSizeBytes { get; set; }
    public int? BitrateKbps { get; set; }

    // Primary stream details
    public string? VideoCodec { get; set; }
    public string? AudioCodec { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public double? FrameRate { get; set; }

    // Streams
    public List<MediaStream> Streams { get; set; } = new();

    // Embedded tags
    public Dictionary<string, string> Tags { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    // Image EXIF
    public PhotoExifData? Exif { get; set; }
}

public class PhotoExifData
{
    public DateTime? DateTakenUtc { get; set; }
    public string? CameraMake { get; set; }
    public string? CameraModel { get; set; }
    public string? LensModel { get; set; }
    public double? FocalLengthMm { get; set; }
    public double? ApertureFNumber { get; set; }
    public string? ShutterSpeed { get; set; }
    public int? IsoSpeed { get; set; }
    public int Orientation { get; set; } = 1;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}

public interface IFFprobeAnalyzer
{
    Task<MediaProbeResult> ProbeFileAsync(string filePath, CancellationToken cancellationToken = default);
}

public class FFprobeAnalyzer : IFFprobeAnalyzer
{
    private readonly IFFmpegRunner _runner;

    public FFprobeAnalyzer(IFFmpegRunner runner)
    {
        _runner = runner;
    }

    public async Task<MediaProbeResult> ProbeFileAsync(string filePath, CancellationToken cancellationToken = default)
    {
        var result = new MediaProbeResult();

        if (!File.Exists(filePath))
        {
            result.Success = false;
            result.ErrorMessage = $"File not found: {filePath}";
            return result;
        }

        try
        {
            var fileInfo = new FileInfo(filePath);
            result.FileSizeBytes = fileInfo.Length;

            var escapedPath = filePath.Replace("\"", "\\\"");
            var args = $"-v quiet -print_format json -show_format -show_streams \"{escapedPath}\"";

            var execution = await _runner.RunFFprobeAsync(args, cancellationToken);
            if (!execution.Success || string.IsNullOrWhiteSpace(execution.StandardOutput))
            {
                result.Success = false;
                result.ErrorMessage = string.IsNullOrWhiteSpace(execution.StandardError)
                    ? "FFprobe returned no output"
                    : execution.StandardError;
                return result;
            }

            using var doc = JsonDocument.Parse(execution.StandardOutput);
            var root = doc.RootElement;

            // Parse Format
            if (root.TryGetProperty("format", out var formatProp))
            {
                if (formatProp.TryGetProperty("format_name", out var formatName))
                    result.ContainerFormat = formatName.GetString() ?? string.Empty;

                if (formatProp.TryGetProperty("duration", out var durVal) &&
                    double.TryParse(durVal.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var dur))
                {
                    result.DurationSeconds = dur;
                }

                if (formatProp.TryGetProperty("bit_rate", out var brVal) &&
                    long.TryParse(brVal.GetString(), out var br))
                {
                    result.BitrateKbps = (int)(br / 1000);
                }

                if (formatProp.TryGetProperty("tags", out var tagsProp))
                {
                    foreach (var prop in tagsProp.EnumerateObject())
                    {
                        result.Tags[prop.Name] = prop.Value.GetString() ?? string.Empty;
                    }
                }
            }

            // Parse Streams
            if (root.TryGetProperty("streams", out var streamsProp))
            {
                int streamIndex = 0;
                foreach (var streamElem in streamsProp.EnumerateArray())
                {
                    var codecType = streamElem.TryGetProperty("codec_type", out var ct) ? ct.GetString() : null;
                    var codecName = streamElem.TryGetProperty("codec_name", out var cn) ? cn.GetString() : "unknown";

                    MediaStreamType streamType = codecType switch
                    {
                        "video" => MediaStreamType.Video,
                        "audio" => MediaStreamType.Audio,
                        "subtitle" => MediaStreamType.Subtitle,
                        _ => MediaStreamType.Attachment
                    };

                    var mediaStream = new MediaStream
                    {
                        StreamIndex = streamIndex++,
                        StreamType = streamType,
                        Codec = codecName ?? "unknown",
                        Profile = streamElem.TryGetProperty("profile", out var prof) ? prof.GetString() : null
                    };

                    // Disposition flags
                    if (streamElem.TryGetProperty("disposition", out var dispProp))
                    {
                        if (dispProp.TryGetProperty("default", out var defVal))
                            mediaStream.IsDefault = defVal.GetInt32() == 1;
                        if (dispProp.TryGetProperty("forced", out var fVal))
                            mediaStream.IsForced = fVal.GetInt32() == 1;
                    }

                    // Stream tags (language, title)
                    if (streamElem.TryGetProperty("tags", out var sTagsProp))
                    {
                        if (sTagsProp.TryGetProperty("language", out var langVal))
                            mediaStream.Language = langVal.GetString();
                        if (sTagsProp.TryGetProperty("title", out var titleVal))
                            mediaStream.Title = titleVal.GetString();

                        // Copy stream tags into result tags if not present
                        foreach (var prop in sTagsProp.EnumerateObject())
                        {
                            if (!result.Tags.ContainsKey(prop.Name))
                                result.Tags[prop.Name] = prop.Value.GetString() ?? string.Empty;
                        }
                    }

                    if (streamType == MediaStreamType.Video)
                    {
                        if (streamElem.TryGetProperty("width", out var wVal))
                            mediaStream.Width = wVal.GetInt32();
                        if (streamElem.TryGetProperty("height", out var hVal))
                            mediaStream.Height = hVal.GetInt32();
                        if (streamElem.TryGetProperty("display_aspect_ratio", out var darVal))
                            mediaStream.AspectRatio = darVal.GetString();

                        if (streamElem.TryGetProperty("r_frame_rate", out var rfrVal))
                        {
                            var parts = rfrVal.GetString()?.Split('/');
                            if (parts != null && parts.Length == 2 &&
                                double.TryParse(parts[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var num) &&
                                double.TryParse(parts[1], NumberStyles.Any, CultureInfo.InvariantCulture, out var den) &&
                                den > 0)
                            {
                                result.FrameRate = Math.Round(num / den, 2);
                            }
                        }

                        if (result.VideoCodec == null)
                        {
                            result.VideoCodec = mediaStream.Codec;
                            result.Width = mediaStream.Width;
                            result.Height = mediaStream.Height;
                        }
                    }
                    else if (streamType == MediaStreamType.Audio)
                    {
                        if (streamElem.TryGetProperty("channels", out var chVal))
                            mediaStream.Channels = chVal.GetInt32();
                        if (streamElem.TryGetProperty("sample_rate", out var srVal) &&
                            int.TryParse(srVal.GetString(), out var sr))
                        {
                            mediaStream.SampleRate = sr;
                        }

                        if (result.AudioCodec == null)
                        {
                            result.AudioCodec = mediaStream.Codec;
                        }
                    }

                    result.Streams.Add(mediaStream);
                }
            }

            // Parse EXIF for photos if available
            ExtractExifFromTags(result);

            result.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.ErrorMessage = ex.Message;
            return result;
        }
    }

    private static void ExtractExifFromTags(MediaProbeResult result)
    {
        if (result.Tags.Count == 0) return;

        var exif = new PhotoExifData();
        bool hasExif = false;

        if (result.Tags.TryGetValue("make", out var make))
        {
            exif.CameraMake = make;
            hasExif = true;
        }
        if (result.Tags.TryGetValue("model", out var model))
        {
            exif.CameraModel = model;
            hasExif = true;
        }
        if (result.Tags.TryGetValue("lens_model", out var lens) || result.Tags.TryGetValue("lens", out lens))
        {
            exif.LensModel = lens;
            hasExif = true;
        }
        if (result.Tags.TryGetValue("focal_length", out var focal))
        {
            if (double.TryParse(focal.Split(' ')[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var fl))
            {
                exif.FocalLengthMm = fl;
                hasExif = true;
            }
        }
        if (result.Tags.TryGetValue("fnumber", out var fnumber) || result.Tags.TryGetValue("aperture_value", out fnumber))
        {
            if (double.TryParse(fnumber.Split(' ')[0], NumberStyles.Any, CultureInfo.InvariantCulture, out var fn))
            {
                exif.ApertureFNumber = fn;
                hasExif = true;
            }
        }
        if (result.Tags.TryGetValue("exposure_time", out var shutter))
        {
            exif.ShutterSpeed = shutter;
            hasExif = true;
        }
        if (result.Tags.TryGetValue("iso_speed_ratings", out var iso) || result.Tags.TryGetValue("iso", out iso))
        {
            if (int.TryParse(iso, out var isoVal))
            {
                exif.IsoSpeed = isoVal;
                hasExif = true;
            }
        }
        if (result.Tags.TryGetValue("datetime_original", out var dateTaken) || result.Tags.TryGetValue("date", out dateTaken))
        {
            if (DateTime.TryParse(dateTaken, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var dt))
            {
                exif.DateTakenUtc = dt;
                hasExif = true;
            }
        }
        if (result.Tags.TryGetValue("orientation", out var orient) && int.TryParse(orient, out var oVal))
        {
            exif.Orientation = oVal;
            hasExif = true;
        }

        if (hasExif)
        {
            result.Exif = exif;
        }
    }
}

