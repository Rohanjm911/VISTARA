using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vistara.Infrastructure.Data;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ArtworkController : ControllerBase
{
    private readonly VistaraDbContext _context;

    public ArtworkController(VistaraDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id}")]
    [ResponseCache(Duration = 604800, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> GetArtwork(Guid id)
    {
        var artwork = await _context.Artworks.FirstOrDefaultAsync(a => a.Id == id);
        if (artwork == null || !System.IO.File.Exists(artwork.AbsolutePath))
            return NotFound();

        return PhysicalFile(artwork.AbsolutePath, artwork.MimeType);
    }
}

