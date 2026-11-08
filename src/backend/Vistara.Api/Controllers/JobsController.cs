using Microsoft.AspNetCore.Mvc;
using Vistara.Core.DTOs;
using Vistara.Services.Tasks;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class JobsController : ControllerBase
{
    private readonly IBackgroundTaskManager _taskManager;

    public JobsController(IBackgroundTaskManager taskManager)
    {
        _taskManager = taskManager;
    }

    [HttpGet]
    public IActionResult GetJobs()
    {
        var jobs = _taskManager.GetActiveJobs();
        return Ok(ApiResponse<List<BackgroundJobDto>>.Ok(jobs));
    }

    [HttpGet("{id}")]
    public IActionResult GetJob(Guid id)
    {
        var job = _taskManager.GetJob(id);
        if (job == null) return NotFound(ApiResponse<BackgroundJobDto>.Fail("Job not found"));
        return Ok(ApiResponse<BackgroundJobDto>.Ok(job));
    }

    [HttpPost("{id}/cancel")]
    public IActionResult CancelJob(Guid id)
    {
        var success = _taskManager.CancelJob(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Job cancelled" : "Could not cancel job"));
    }

    [HttpPost("{id}/pause")]
    public IActionResult PauseJob(Guid id)
    {
        var success = _taskManager.PauseJob(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Job paused" : "Could not pause job"));
    }

    [HttpPost("{id}/resume")]
    public IActionResult ResumeJob(Guid id)
    {
        var success = _taskManager.ResumeJob(id);
        return Ok(ApiResponse<bool>.Ok(success, success ? "Job resumed" : "Could not resume job"));
    }
}

