using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Vistara.Core.DTOs;

namespace Vistara.MediaEngine;

public interface ISubtitleService
{
    Task<string?> ExtractOrConvertSubtitleToVttAsync(string videoPath, int streamIndex, CancellationToken cancellationToken = default);
    string ConvertSrtContentToVtt(string srtContent);
    Task<List<OnlineSubtitleResultDto>> SearchOnlineSubtitlesAsync(
        string? query,
        string? imdbId,
        string type,
        int? season,
        int? episode,
        string? language,
        CancellationToken cancellationToken = default);
    Task<DownloadOnlineSubtitleResponse?> DownloadAndConvertOnlineSubtitleAsync(
        DownloadOnlineSubtitleRequest request,
        CancellationToken cancellationToken = default);
    string? GetCachedSubtitlePath(string cacheFileName);
}

public class SubtitleService : ISubtitleService
{
    private readonly IFFmpegRunner _runner;
    private readonly ILogger<SubtitleService> _logger;
    private readonly string _cacheDirectory;

    private static readonly Dictionary<string, string> LanguageNames = new(StringComparer.OrdinalIgnoreCase)
    {
        { "eng", "English" },
        { "en", "English" },
        { "hin", "Hindi" },
        { "hi", "Hindi" },
        { "spa", "Spanish" },
        { "es", "Spanish" },
        { "fre", "French" },
        { "fra", "French" },
        { "fr", "French" },
        { "ger", "German" },
        { "deu", "German" },
        { "de", "German" },
        { "ita", "Italian" },
        { "it", "Italian" },
        { "por", "Portuguese" },
        { "pob", "Portuguese (BR)" },
        { "pt", "Portuguese" },
        { "rus", "Russian" },
        { "ru", "Russian" },
        { "ara", "Arabic" },
        { "ar", "Arabic" },
        { "chi", "Chinese" },
        { "zho", "Chinese" },
        { "zh", "Chinese" },
        { "jpn", "Japanese" },
        { "ja", "Japanese" },
        { "kor", "Korean" },
        { "ko", "Korean" },
        { "tur", "Turkish" },
        { "tr", "Turkish" },
        { "nld", "Dutch" },
        { "dut", "Dutch" },
        { "nl", "Dutch" },
        { "pol", "Polish" },
        { "pl", "Polish" },
        { "swe", "Swedish" },
        { "sv", "Swedish" },
        { "nor", "Norwegian" },
        { "no", "Norwegian" },
        { "dan", "Danish" },
        { "da", "Danish" },
        { "fin", "Finnish" },
        { "fi", "Finnish" },
        { "ind", "Indonesian" },
        { "id", "Indonesian" },
        { "vie", "Vietnamese" },
        { "vi", "Vietnamese" },
        { "tha", "Thai" },
        { "th", "Thai" },
        { "ell", "Greek" },
        { "gre", "Greek" },
        { "el", "Greek" },
        { "heb", "Hebrew" },
        { "he", "Hebrew" },
        { "ben", "Bengali" },
        { "bn", "Bengali" },
        { "tam", "Tamil" },
        { "ta", "Tamil" },
        { "tel", "Telugu" },
        { "te", "Telugu" },
        { "urd", "Urdu" },
        { "ur", "Urdu" },
        { "pan", "Punjabi" },
        { "pa", "Punjabi" },
        { "mar", "Marathi" },
        { "mr", "Marathi" }
    };

    public SubtitleService(IFFmpegRunner runner, ILogger<SubtitleService> logger)
    {
        _runner = runner;
        _logger = logger;
        _cacheDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "cache", "subtitles");
        Directory.CreateDirectory(_cacheDirectory);
    }

    public async Task<string?> ExtractOrConvertSubtitleToVttAsync(string videoPath, int streamIndex, CancellationToken cancellationToken = default)
    {
        if (!File.Exists(videoPath)) return null;

        var hash = (videoPath + "_" + streamIndex).GetHashCode().ToString("X8");
        var outputPath = Path.Combine(_cacheDirectory, $"sub_{hash}.vtt");

        if (File.Exists(outputPath) && new FileInfo(outputPath).Length > 0)
            return outputPath;

        var escapedIn = videoPath.Replace("\"", "\\\"");
        var escapedOut = outputPath.Replace("\"", "\\\"");

        var args = $"-i \"{escapedIn}\" -map 0:{streamIndex} -f webvtt -y \"{escapedOut}\"";
        var result = await _runner.RunFFmpegAsync(args, cancellationToken);

        return (result.Success && File.Exists(outputPath)) ? outputPath : null;
    }

    public string ConvertSrtContentToVtt(string srtContent)
    {
        var sb = new StringBuilder();
        sb.AppendLine("WEBVTT");
        sb.AppendLine();

        using var reader = new StringReader(srtContent);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (line.Contains("-->"))
            {
                // Convert SRT comma millisecond separator (00:01:20,500) to VTT period (00:01:20.500)
                line = line.Replace(',', '.');
            }
            sb.AppendLine(line);
        }

        return sb.ToString();
    }

    public async Task<List<OnlineSubtitleResultDto>> SearchOnlineSubtitlesAsync(
        string? query,
        string? imdbId,
        string type,
        int? season,
        int? episode,
        string? language,
        CancellationToken cancellationToken = default)
    {
        var results = new List<OnlineSubtitleResultDto>();
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(12) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Vistara/1.0");

        // 1. Resolve IMDb ID if missing
        if (string.IsNullOrWhiteSpace(imdbId) && !string.IsNullOrWhiteSpace(query))
        {
            imdbId = await ResolveImdbIdAsync(client, query, type, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(imdbId))
        {
            _logger.LogInformation("Could not resolve IMDb ID for online subtitle search query: {Query}", query);
            return results;
        }

        // 2. Query open-source OpenSubtitles v3 protocol
        string url;
        if (type.Equals("series", StringComparison.OrdinalIgnoreCase) && season.HasValue && episode.HasValue)
        {
            url = $"https://opensubtitles-v3.strem.io/subtitles/series/{imdbId}:{season.Value}:{episode.Value}.json";
        }
        else
        {
            url = $"https://opensubtitles-v3.strem.io/subtitles/movie/{imdbId}.json";
        }

        try
        {
            var response = await client.GetAsync(url, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("subtitles", out var subsElement) && subsElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in subsElement.EnumerateArray())
                    {
                        var id = item.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : "";
                        var lang = item.TryGetProperty("lang", out var langProp) ? langProp.GetString() ?? "" : "";
                        var downloadUrl = item.TryGetProperty("url", out var urlProp) ? urlProp.GetString() ?? "" : "";

                        if (string.IsNullOrWhiteSpace(downloadUrl)) continue;

                        // Filter by language if specified and not "all"
                        if (!string.IsNullOrWhiteSpace(language) && !language.Equals("all", StringComparison.OrdinalIgnoreCase))
                        {
                            if (!lang.Equals(language, StringComparison.OrdinalIgnoreCase)) continue;
                        }

                        var langName = GetLanguageName(lang);

                        results.Add(new OnlineSubtitleResultDto
                        {
                            Id = id,
                            Language = lang.ToLowerInvariant(),
                            LanguageName = langName,
                            DownloadUrl = downloadUrl,
                            Title = $"{langName} Subtitle ({id})",
                            Source = "OpenSubtitles (Community)"
                        });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed querying OpenSubtitles v3 for {ImdbId}", imdbId);
        }

        return results;
    }

    public async Task<DownloadOnlineSubtitleResponse?> DownloadAndConvertOnlineSubtitleAsync(
        DownloadOnlineSubtitleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.DownloadUrl)) return null;

        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Vistara/1.0");

        try
        {
            var response = await client.GetAsync(request.DownloadUrl, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            var rawBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            string content;

            // Check if gzipped (magic bytes 0x1F, 0x8B)
            if (rawBytes.Length > 2 && rawBytes[0] == 0x1F && rawBytes[1] == 0x8B)
            {
                using var ms = new MemoryStream(rawBytes);
                using var gz = new GZipStream(ms, CompressionMode.Decompress);
                using var reader = new StreamReader(gz, Encoding.UTF8);
                content = await reader.ReadToEndAsync(cancellationToken);
            }
            // Check if zip archive (magic bytes 0x50, 0x4B)
            else if (rawBytes.Length > 4 && rawBytes[0] == 0x50 && rawBytes[1] == 0x4B && rawBytes[2] == 0x03 && rawBytes[3] == 0x04)
            {
                using var ms = new MemoryStream(rawBytes);
                using var zip = new ZipArchive(ms, ZipArchiveMode.Read);
                var entry = zip.Entries.FirstOrDefault(e => e.FullName.EndsWith(".srt", StringComparison.OrdinalIgnoreCase) || e.FullName.EndsWith(".vtt", StringComparison.OrdinalIgnoreCase))
                            ?? zip.Entries.FirstOrDefault();

                if (entry == null) return null;
                using var entryStream = entry.Open();
                using var reader = new StreamReader(entryStream, Encoding.UTF8);
                content = await reader.ReadToEndAsync(cancellationToken);
            }
            else
            {
                content = Encoding.UTF8.GetString(rawBytes);
            }

            // Convert to clean WebVTT format
            content = content.TrimStart('\uFEFF', '\u200B');

            string vttContent;
            if (content.TrimStart().StartsWith("WEBVTT", StringComparison.OrdinalIgnoreCase))
            {
                vttContent = content;
            }
            else
            {
                vttContent = ConvertSrtContentToVtt(content);
            }

            var hash = (request.DownloadUrl + "_" + request.Language).GetHashCode().ToString("X8");
            var cacheFileName = $"online_{hash}_{Guid.NewGuid():N}.vtt";
            var cacheFilePath = Path.Combine(_cacheDirectory, cacheFileName);

            // UTF-8 without BOM for clean HTML5 WebVTT compatibility
            await File.WriteAllTextAsync(cacheFilePath, vttContent, new UTF8Encoding(false), cancellationToken);

            var langName = GetLanguageName(request.Language);

            return new DownloadOnlineSubtitleResponse
            {
                SubtitleUrl = $"/api/v1/subtitles/online/{cacheFileName}",
                Label = $"{langName} (Online)",
                Language = request.Language,
                CacheFileName = cacheFileName
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to download and convert online subtitle from {Url}", request.DownloadUrl);
            return null;
        }
    }

    public string? GetCachedSubtitlePath(string cacheFileName)
    {
        var safeName = Path.GetFileName(cacheFileName);
        var path = Path.Combine(_cacheDirectory, safeName);
        return File.Exists(path) ? path : null;
    }

    private static string GetLanguageName(string code)
    {
        if (LanguageNames.TryGetValue(code.Trim(), out var name))
            return name;

        return code.ToUpperInvariant();
    }

    private async Task<string?> ResolveImdbIdAsync(HttpClient client, string query, string type, CancellationToken cancellationToken)
    {
        try
        {
            // Clean up query: remove release terms, codecs, scene tags
            var clean = Regex.Replace(query, @"\b(1080p|720p|4k|2160p|x264|x265|hevc|web-dl|bluray|aac|hindi|english|complete-zip|vegamovie)\b.*$", "", RegexOptions.IgnoreCase).Trim();
            clean = clean.Replace('.', ' ').Replace('_', ' ').Trim();

            var catalogType = type.Equals("series", StringComparison.OrdinalIgnoreCase) ? "series" : "movie";
            var enc = Uri.EscapeDataString(clean);
            var url = $"https://v3-cinemeta.strem.io/catalog/{catalogType}/top/search={enc}.json";

            var response = await client.GetAsync(url, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("metas", out var metas) && metas.ValueKind == JsonValueKind.Array)
                {
                    var first = metas.EnumerateArray().FirstOrDefault();
                    if (first.ValueKind == JsonValueKind.Object && first.TryGetProperty("id", out var idProp))
                    {
                        return idProp.GetString();
                    }
                }
            }
        }
        catch { }
        return null;
    }
}
