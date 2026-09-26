using HizliSatis.Domain.Master;
using HizliSatis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HizliSatis.Infrastructure.Services;

public class MasterSeedService(
    MasterDbContext db,
    ILogger<MasterSeedService> logger)
{
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        await EnsureLicenseColumnAsync(ct);

        if (!await db.PlatformAdmins.AnyAsync(ct))
        {
            db.PlatformAdmins.Add(new PlatformAdmin
            {
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                DisplayName = "Platform Yöneticisi"
            });
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Platform admin seeded: admin / Admin123!");
        }
    }

    private async Task EnsureLicenseColumnAsync(CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(
            """
            IF COL_LENGTH('Tenants', 'LicenseExpiresAt') IS NULL
            BEGIN
                ALTER TABLE Tenants ADD LicenseExpiresAt datetime2 NULL;
                EXEC(N'UPDATE Tenants SET LicenseExpiresAt = DATEADD(year, 1, CreatedAt)');
                EXEC(N'ALTER TABLE Tenants ALTER COLUMN LicenseExpiresAt datetime2 NOT NULL');
            END
            """,
            ct);
    }
}
