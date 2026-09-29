using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Infrastructure.Tenancy;

public class TenantDbContextFactory(ITenantContext tenantContext)
{
    public TenantDbContext Create()
    {
        if (!tenantContext.IsResolved)
            throw new InvalidOperationException("Tenant bağlantısı çözümlenemedi. Firma kodu ile giriş yapın.");

        var options = new DbContextOptionsBuilder<TenantDbContext>()
            .UseSqlServer(tenantContext.ConnectionString)
            .Options;

        return new TenantDbContext(options);
    }

    public static TenantDbContext CreateForConnection(string connectionString)
    {
        var options = new DbContextOptionsBuilder<TenantDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new TenantDbContext(options);
    }
}
