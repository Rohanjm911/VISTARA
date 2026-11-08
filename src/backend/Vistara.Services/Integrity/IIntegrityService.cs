using Vistara.Core.DTOs;
using Vistara.Core.Enums;

namespace Vistara.Services.Integrity;

public interface IIntegrityService
{
    Task<IntegrityDashboardDto> GetDashboardAsync(CancellationToken cancellationToken = default);
    Task<List<IntegrityScanDto>> GetScansAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<IntegrityScanDto?> GetScanByIdAsync(Guid scanId, CancellationToken cancellationToken = default);
    Task<IntegrityScanDto> StartScanAsync(StartIntegrityScanRequest request, string triggeredBy = "Manual", CancellationToken cancellationToken = default);
    bool PauseScan(Guid scanId);
    bool ResumeScan(Guid scanId);
    bool CancelScan(Guid scanId);
    Task<IntegrityFileRecordDto> VerifySingleFileAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
    Task<List<IntegrityVerificationHistoryDto>> GetFileHistoryAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
    Task<PagedResult<IntegrityFileRecordDto>> GetIssuesAsync(IntegrityFileStatus? status, Guid? libraryId, string? search, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<bool> RelinkFileAsync(Guid mediaFileId, string newPath, CancellationToken cancellationToken = default);
    Task<List<RecoveryCandidateDto>> FindRecoveryCandidatesAsync(Guid mediaFileId, CancellationToken cancellationToken = default);
    Task<byte[]> ExportReportAsync(string format, CancellationToken cancellationToken = default);
    Task<IntegritySettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default);
    Task<bool> UpdateSettingsAsync(IntegritySettingsDto settings, CancellationToken cancellationToken = default);
}

