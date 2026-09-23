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
}
