using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Vistara.Infrastructure.Data;
using Vistara.Infrastructure.Security;
using Xunit;

namespace Vistara.UnitTests.Security;

public class PathSecurityValidatorTests
{
    private VistaraDbContext CreateSqliteMemoryDbContext()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<VistaraDbContext>()
            .UseSqlite(connection)
            .Options;
        var context = new VistaraDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }

    [Fact]
    public void IsPathWithinRoot_AllowedSubPath_ReturnsTrue()
    {
        using var db = CreateSqliteMemoryDbContext();
        var validator = new PathSecurityValidator(db);

        string allowedRoot = @"D:\Media\Movies";
        string subFile = @"D:\Media\Movies\Action\Movie.mp4";

        Assert.True(validator.IsPathWithinRoot(subFile, allowedRoot));
    }

    [Fact]
    public void IsPathWithinRoot_PathTraversalAttempt_ReturnsFalse()
    {
        using var db = CreateSqliteMemoryDbContext();
        var validator = new PathSecurityValidator(db);

        string allowedRoot = @"D:\Media\Movies";
        string maliciousPath = @"D:\Media\Movies\..\..\Windows\System32\cmd.exe";

        Assert.False(validator.IsPathWithinRoot(maliciousPath, allowedRoot));
    }

    [Fact]
    public void IsPathWithinRoot_ExactRoot_ReturnsTrue()
    {
        using var db = CreateSqliteMemoryDbContext();
        var validator = new PathSecurityValidator(db);

        string allowedRoot = @"D:\Media\Movies";

        Assert.True(validator.IsPathWithinRoot(allowedRoot, allowedRoot));
    }

    [Fact]
    public void IsPathWithinRoot_SiblingDirectory_ReturnsFalse()
    {
        using var db = CreateSqliteMemoryDbContext();
        var validator = new PathSecurityValidator(db);

        string allowedRoot = @"D:\Media\Movies";
        string siblingPath = @"D:\Media\MoviesConfidential\Secret.txt";

        Assert.False(validator.IsPathWithinRoot(siblingPath, allowedRoot));
    }
}
