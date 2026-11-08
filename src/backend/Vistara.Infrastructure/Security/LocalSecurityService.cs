using System.Security.Cryptography;
using System.Text;

namespace Vistara.Infrastructure.Security;

public interface ILocalSecurityService
{
    string InstallationSecret { get; }
    string GenerateBootstrapTicket();
    bool ValidateBootstrapTicket(string ticket);
    string CreateSessionToken();
    bool ValidateSessionToken(string token);
    bool ValidateHost(string? host);
    bool ValidateOrigin(string? origin);
    string GenerateCsrfToken();
    bool ValidateCsrfToken(string token);
}

public class LocalSecurityService : ILocalSecurityService
{
    private readonly string _secretKey;
    private readonly HashSet<string> _activeBootstrapTickets = new();
    private readonly HashSet<string> _activeSessions = new();
    private readonly HashSet<string> _activeCsrfTokens = new();
    private readonly object _lock = new();

    public string InstallationSecret => _secretKey;

    public LocalSecurityService()
    {
        var appDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Vistara", "security");
        Directory.CreateDirectory(appDataDir);

        var keyFile = Path.Combine(appDataDir, "installation.key");
        if (File.Exists(keyFile))
        {
            try
            {
                var storedKey = File.ReadAllText(keyFile, Encoding.UTF8).Trim();
                if (!string.IsNullOrEmpty(storedKey) && storedKey.Length >= 32)
                {
                    _secretKey = storedKey;
                    return;
                }
            }
            catch
            {
                // Fallback to generating a new key
            }
        }

        // Generate strong random key
        var randomBytes = new byte[32];
        RandomNumberGenerator.Fill(randomBytes);
        _secretKey = Convert.ToBase64String(randomBytes);
        try
        {
            File.WriteAllText(keyFile, _secretKey, Encoding.UTF8);
        }
        catch
        {
            // If file write fails, in-memory key will still function for this session
        }
    }

    public string GenerateBootstrapTicket()
    {
        lock (_lock)
        {
            var ticket = Guid.NewGuid().ToString("N") + "." + DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            _activeBootstrapTickets.Add(ticket);
            return ticket;
        }
    }

    public bool ValidateBootstrapTicket(string ticket)
    {
        if (string.IsNullOrWhiteSpace(ticket))
            return false;

        lock (_lock)
        {
            if (_activeBootstrapTickets.Remove(ticket))
            {
                var parts = ticket.Split('.');
                if (parts.Length == 2 && long.TryParse(parts[1], out var timestamp))
                {
                    var ticketTime = DateTimeOffset.FromUnixTimeSeconds(timestamp);
                    // Tickets expire in 60 seconds
                    return DateTimeOffset.UtcNow - ticketTime < TimeSpan.FromSeconds(60);
                }
            }
            return false;
        }
    }

    public string CreateSessionToken()
    {
        lock (_lock)
        {
            var tokenBytes = new byte[32];
            RandomNumberGenerator.Fill(tokenBytes);
            var token = Convert.ToBase64String(tokenBytes);
            _activeSessions.Add(token);
            return token;
        }
    }

    public bool ValidateSessionToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return false;

        lock (_lock)
        {
            return _activeSessions.Contains(token);
        }
    }

    public bool ValidateHost(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
            return false;

        // Strip port if present
        var hostName = host.Split(':')[0].Trim();
        return hostName.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
               hostName.Equals("localhost", StringComparison.OrdinalIgnoreCase);
    }

    public bool ValidateOrigin(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
            return true; // Non-CORS or same-origin direct browser requests can have null Origin

        try
        {
            var uri = new Uri(origin);
            var host = uri.Host;
            var isLocal = host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                          host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                          uri.Scheme.Equals("app", StringComparison.OrdinalIgnoreCase);
            return isLocal;
        }
        catch
        {
            return false;
        }
    }

    public string GenerateCsrfToken()
    {
        lock (_lock)
        {
            var tokenBytes = new byte[24];
            RandomNumberGenerator.Fill(tokenBytes);
            var token = Convert.ToBase64String(tokenBytes);
            _activeCsrfTokens.Add(token);
            return token;
        }
    }

    public bool ValidateCsrfToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return false;

        lock (_lock)
        {
            return _activeCsrfTokens.Contains(token);
        }
    }
}

