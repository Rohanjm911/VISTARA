using Vistara.Infrastructure.Security;

namespace Vistara.Api.Middleware;

public class LocalSecurityMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILocalSecurityService _securityService;

    public LocalSecurityMiddleware(RequestDelegate next, ILocalSecurityService securityService)
    {
        _next = next;
        _securityService = securityService;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // 1. Host Validation
        var host = context.Request.Host.Value;
        if (!_securityService.ValidateHost(host))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Forbidden: Host header must be localhost or 127.0.0.1");
            return;
        }

        // 2. Origin Validation
        var origin = context.Request.Headers["Origin"].ToString();
        if (!string.IsNullOrEmpty(origin) && !_securityService.ValidateOrigin(origin))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsync("Forbidden: Origin not permitted");
            return;
        }

        // 3. Security headers
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
        context.Response.Headers.Append("X-Frame-Options", "DENY");
        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

        await _next(context);
    }
}

