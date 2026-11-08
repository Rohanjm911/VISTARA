using Microsoft.AspNetCore.Mvc;
using Vistara.Core.DTOs;
using Vistara.Core.Enums;
using Vistara.Core.Models;
using Vistara.Services.Backup;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class BackupsController : ControllerBase
{
    private readonly IBackupService _backup;

    public BackupsController(IBackupService backup)
    {
        _backup = backup;
    }

    [HttpGet]
    public async Task<IActionResult> GetBackups()
    {
        var backups = await _backup.GetBackupsAsync();
        return Ok(ApiResponse<List<BackupHistory>>.Ok(backups));
    }

    [HttpPost]
    public async Task<IActionResult> CreateBackup([FromBody] CreateBackupApiRequest? request)
    {
        var type = request?.Type ?? BackupType.Manual;
        var backup = await _backup.CreateBackupAsync(type, request?.Notes);
        return Ok(ApiResponse<BackupHistory>.Ok(backup, "Backup created successfully"));
    }

    [HttpPost("{id}/verify")]
    public async Task<IActionResult> VerifyBackup(Guid id)
    {
        var valid = await _backup.VerifyBackupAsync(id);
        return Ok(ApiResponse<bool>.Ok(valid, valid ? "Backup integrity verified" : "Backup verification failed"));
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreBackup(Guid id)
    {
        var success = await _backup.RestoreBackupAsync(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Backup restored successfully" : "Backup restore failed"));
    }
}

public class CreateBackupApiRequest
{
    public BackupType Type { get; set; } = BackupType.Manual;
    public string? Notes { get; set; }
}

