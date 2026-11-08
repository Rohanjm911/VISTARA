using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Vistara.Api.Hubs;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Services.Integrity;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class IntegrityController : ControllerBase
{
    private readonly IIntegrityService _integrityService;
    private readonly IHubContext<VistaraHub, IVistaraClient> _hubContext;
    private readonly ILogger<IntegrityController> _logger;
    private static bool _signalRSubscribed = false;
    private static readonly object _subLock = new();

    public IntegrityController(
        IIntegrityService integrityService,
        IHubContext<VistaraHub, IVistaraClient> hubContext,
        ILogger<IntegrityController> logger)
    {
        _integrityService = integrityService;
        _hubContext = hubContext;
        _logger = logger;

        lock (_subLock)
        {
            if (!_signalRSubscribed)
            {
                _signalRSubscribed = true;
                IntegrityService.OnScanProgress += (progress) =>
                {
                    _ = _hubContext.Clients.All.IntegrityScanProgress(progress);
                };
                IntegrityService.OnIssueDetected += (issue) =>
                {
                    _ = _hubContext.Clients.All.IntegrityIssueDetected(issue);
                };
                IntegrityService.OnScanCompleted += (scan) =>
                {
                    _ = _hubContext.Clients.All.IntegrityScanCompleted(scan);
                };
            }
        }
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResponse<IntegrityDashboardDto>>> GetDashboard(CancellationToken cancellationToken)
    {
        var dashboard = await _integrityService.GetDashboardAsync(cancellationToken);
        return Ok(ApiResponse<IntegrityDashboardDto>.Ok(dashboard));
    }

    [HttpGet("status")]
    public async Task<ActionResult<ApiResponse<object>>> GetStatus(CancellationToken cancellationToken)
    {
        var dashboard = await _integrityService.GetDashboardAsync(cancellationToken);
        return Ok(ApiResponse<object>.Ok(new
        {
            isScanRunning = dashboard.IsScanRunning,
            currentScan = dashboard.CurrentScan,
            lastScanTimestampUtc = dashboard.LastScanTimestampUtc,
            lastScanStatus = dashboard.LastScanStatus
        }));
    }

    [HttpGet("scans")]
    public async Task<ActionResult<ApiResponse<List<IntegrityScanDto>>>> GetScans([FromQuery] int limit = 20, CancellationToken cancellationToken = default)
    {
        var scans = await _integrityService.GetScansAsync(limit, cancellationToken);
        return Ok(ApiResponse<List<IntegrityScanDto>>.Ok(scans));
    }

    [HttpPost("scans")]
    public async Task<ActionResult<ApiResponse<IntegrityScanDto>>> StartScan([FromBody] StartIntegrityScanRequest request, CancellationToken cancellationToken)
    {
        var scan = await _integrityService.StartScanAsync(request, "Manual", cancellationToken);
        return Ok(ApiResponse<IntegrityScanDto>.Ok(scan, "Integrity scan started."));
    }

    [HttpGet("scans/{id:guid}")]
    public async Task<ActionResult<ApiResponse<IntegrityScanDto>>> GetScanById(Guid id, CancellationToken cancellationToken)
    {
        var scan = await _integrityService.GetScanByIdAsync(id, cancellationToken);
        if (scan == null) return NotFound(ApiResponse<IntegrityScanDto>.Fail("Scan not found."));
        return Ok(ApiResponse<IntegrityScanDto>.Ok(scan));
    }

    [HttpPost("scans/{id:guid}/pause")]
    public ActionResult<ApiResponse<bool>> PauseScan(Guid id)
    {
        var success = _integrityService.PauseScan(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Scan paused." : "Unable to pause scan."));
    }

    [HttpPost("scans/{id:guid}/resume")]
    public ActionResult<ApiResponse<bool>> ResumeScan(Guid id)
    {
        var success = _integrityService.ResumeScan(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Scan resumed." : "Unable to resume scan."));
    }

    [HttpPost("scans/{id:guid}/cancel")]
    public ActionResult<ApiResponse<bool>> CancelScan(Guid id)
    {
        var success = _integrityService.CancelScan(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Scan cancelled." : "Unable to cancel scan."));
    }

    [HttpPost("files/{id:guid}/verify")]
    public async Task<ActionResult<ApiResponse<IntegrityFileRecordDto>>> VerifyFile(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var record = await _integrityService.VerifySingleFileAsync(id, cancellationToken);
            return Ok(ApiResponse<IntegrityFileRecordDto>.Ok(record, "File verified successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<IntegrityFileRecordDto>.Fail(ex.Message));
        }
    }

    [HttpGet("files/{id:guid}/history")]
    public async Task<ActionResult<ApiResponse<List<IntegrityVerificationHistoryDto>>>> GetFileHistory(Guid id, CancellationToken cancellationToken)
    {
        var histories = await _integrityService.GetFileHistoryAsync(id, cancellationToken);
        return Ok(ApiResponse<List<IntegrityVerificationHistoryDto>>.Ok(histories));
    }

    [HttpGet("issues")]
    public async Task<ActionResult<ApiResponse<PagedResult<IntegrityFileRecordDto>>>> GetIssues(
        [FromQuery] IntegrityFileStatus? status,
        [FromQuery] Guid? libraryId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _integrityService.GetIssuesAsync(status, libraryId, search, page, pageSize, cancellationToken);
        return Ok(ApiResponse<PagedResult<IntegrityFileRecordDto>>.Ok(result));
    }

    [HttpPost("files/{id:guid}/relink")]
    public async Task<ActionResult<ApiResponse<bool>>> RelinkFile(Guid id, [FromBody] RelinkMediaFileRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var success = await _integrityService.RelinkFileAsync(id, request.NewPath, cancellationToken);
            return Ok(ApiResponse<bool>.Ok(success, "Media file relinked and verified successfully."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<bool>.Fail(ex.Message));
        }
    }

    [HttpGet("files/{id:guid}/recovery-candidates")]
    public async Task<ActionResult<ApiResponse<List<RecoveryCandidateDto>>>> GetRecoveryCandidates(Guid id, CancellationToken cancellationToken)
    {
        var candidates = await _integrityService.FindRecoveryCandidatesAsync(id, cancellationToken);
        return Ok(ApiResponse<List<RecoveryCandidateDto>>.Ok(candidates));
    }

    [HttpGet("reports/export")]
    public async Task<IActionResult> ExportReport([FromQuery] string format = "csv", CancellationToken cancellationToken = default)
    {
        var bytes = await _integrityService.ExportReportAsync(format, cancellationToken);
        var isJson = string.Equals(format, "json", StringComparison.OrdinalIgnoreCase);
        var contentType = isJson ? "application/json" : "text/csv";
        var fileName = $"Vistara_Media_Integrity_Report_{DateTime.UtcNow:yyyyMMdd_HHmmss}.{(isJson ? "json" : "csv")}";

        return File(bytes, contentType, fileName);
    }

    [HttpGet("settings")]
    public async Task<ActionResult<ApiResponse<IntegritySettingsDto>>> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await _integrityService.GetSettingsAsync(cancellationToken);
        return Ok(ApiResponse<IntegritySettingsDto>.Ok(settings));
    }

    [HttpPut("settings")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateSettings([FromBody] IntegritySettingsDto settings, CancellationToken cancellationToken)
    {
        var success = await _integrityService.UpdateSettingsAsync(settings, cancellationToken);
        return Ok(ApiResponse<bool>.Ok(success, "Settings updated successfully."));
    }
}

