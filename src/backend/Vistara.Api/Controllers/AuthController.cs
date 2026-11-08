using Microsoft.AspNetCore.Mvc;
using Vistara.Core.DTOs;
using Vistara.Infrastructure.Security;

namespace Vistara.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ILocalSecurityService _security;

    public AuthController(ILocalSecurityService security)
    {
        _security = security;
    }

    [HttpGet("bootstrap")]
    public IActionResult Bootstrap()
    {
        var sessionToken = _security.CreateSessionToken();
        var csrfToken = _security.GenerateCsrfToken();

        // Set secure HttpOnly cookie for session token
        Response.Cookies.Append("Vistara_Session", sessionToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure = false // HTTP on localhost
        });

        return Ok(ApiResponse<object>.Ok(new
        {
            CsrfToken = csrfToken,
            ClientSession = sessionToken.Substring(0, 8) + "...",
            IsLocalAccess = true
        }));
    }
}

