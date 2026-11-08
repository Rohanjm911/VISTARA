using Vistara.Core.DTOs;

namespace Vistara.Services.Music;

public interface ILyricsService
{
    Task<LyricsResultDto> GetLyricsAsync(Guid trackOrMediaItemId, bool forceRefresh = false, CancellationToken ct = default);
    Task<LyricsResultDto> FetchAndSaveLyricsAsync(Guid trackOrMediaItemId, FetchLyricsRequest? request = null, CancellationToken ct = default);
    Task<LyricsResultDto> AutoFetchSyncedLyricsAsync(Guid trackOrMediaItemId, CancellationToken ct = default);
    Task<List<LrcLibSearchResultDto>> SearchOnlineLyricsAsync(string query, CancellationToken ct = default);
    Task<LyricsResultDto> ApplyOnlineLyricsAsync(Guid trackOrMediaItemId, int lrclibId, CancellationToken ct = default);
    Task<TranslatedLyricsResultDto> TranslateLyricsAsync(TranslateLyricsRequest request, CancellationToken ct = default);
}

