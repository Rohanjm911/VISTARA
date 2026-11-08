using Microsoft.AspNetCore.Mvc;
using Vistara.Core.DTOs;
using Vistara.Services.Search;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class SearchController : ControllerBase
{
    private readonly IFtsSearchService _search;

    public SearchController(IFtsSearchService search)
    {
        _search = search;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] string? q = null, [FromQuery] string? query = null, [FromQuery] int limit = 10)
    {
        var term = !string.IsNullOrWhiteSpace(q) ? q : (!string.IsNullOrWhiteSpace(query) ? query : string.Empty);
        if (string.IsNullOrWhiteSpace(term))
        {
            return Ok(ApiResponse<SearchResultDto>.Ok(new SearchResultDto()));
        }

        var result = await _search.SearchAsync(term, limit);
        return Ok(ApiResponse<SearchResultDto>.Ok(result));
    }
}

