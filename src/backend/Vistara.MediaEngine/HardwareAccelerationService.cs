namespace Vistara.MediaEngine;

public interface IHardwareAccelerationService
{
    Task<List<string>> GetAvailableMethodsAsync();
    Task<string?> GetBestEncoderAsync(string preferredCodec = "h264");
    Task<string> GetFFmpegAccelerationFlagsAsync(string mode = "auto");
}

public class HardwareAccelerationService : IHardwareAccelerationService
{
    private readonly IFFmpegRunner _runner;
    private List<string>? _cachedMethods;
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public HardwareAccelerationService(IFFmpegRunner runner)
    {
        _runner = runner;
    }

    public async Task<List<string>> GetAvailableMethodsAsync()
    {
        if (_cachedMethods != null) return _cachedMethods;

        await _semaphore.WaitAsync();
        try
        {
            if (_cachedMethods != null) return _cachedMethods;

            var result = await _runner.RunFFmpegAsync("-hwaccels");
            var methods = new List<string>();

            if (result.Success)
            {
                var lines = result.StandardOutput.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                bool headerFound = false;
                foreach (var line in lines)
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("Hardware acceleration methods:", StringComparison.OrdinalIgnoreCase))
                    {
                        headerFound = true;
                        continue;
                    }
                    if (headerFound && !string.IsNullOrWhiteSpace(trimmed))
                    {
                        methods.Add(trimmed.ToLowerInvariant());
                    }
                }
            }

            _cachedMethods = methods;
            return methods;
        }
        catch
        {
            return new List<string> { "none" };
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<string?> GetBestEncoderAsync(string preferredCodec = "h264")
    {
        var methods = await GetAvailableMethodsAsync();

        if (preferredCodec.Equals("h264", StringComparison.OrdinalIgnoreCase))
        {
            if (methods.Contains("cuda") || methods.Contains("nvdec")) return "h264_nvenc";
            if (methods.Contains("qsv")) return "h264_qsv";
            if (methods.Contains("amf")) return "h264_amf";
            if (methods.Contains("d3d11va") || methods.Contains("dxva2")) return "h264_mf";
            return "libx264";
        }
        else if (preferredCodec.Equals("hevc", StringComparison.OrdinalIgnoreCase) || preferredCodec.Equals("h265", StringComparison.OrdinalIgnoreCase))
        {
            if (methods.Contains("cuda")) return "hevc_nvenc";
            if (methods.Contains("qsv")) return "hevc_qsv";
            if (methods.Contains("amf")) return "hevc_amf";
            return "libx265";
        }

        return "libx264";
    }

    public async Task<string> GetFFmpegAccelerationFlagsAsync(string mode = "auto")
    {
        if (string.Equals(mode, "software", StringComparison.OrdinalIgnoreCase))
            return string.Empty;

        var methods = await GetAvailableMethodsAsync();

        if (methods.Contains("cuda"))
            return "-hwaccel cuda";
        if (methods.Contains("d3d11va"))
            return "-hwaccel d3d11va";
        if (methods.Contains("dxva2"))
            return "-hwaccel dxva2";
        if (methods.Contains("qsv"))
            return "-hwaccel qsv";
        if (methods.Contains("amf"))
            return "-hwaccel amf";

        return string.Empty;
    }
}

