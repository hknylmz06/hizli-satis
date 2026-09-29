using System.Collections.Concurrent;
using System.Security.Claims;
using HizliSatis.Domain.Enums;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Middleware;

public class TenantResolutionMiddleware(RequestDelegate next)
{
    private static readonly ConcurrentDictionary<string, TenantSnap> Cache = new(StringComparer.OrdinalIgnoreCase);

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext, MasterDbContext masterDb, SqlServerSettingsStore store)
    {
        var firmaKodu = context.User.FindFirstValue("firma_kodu");
        var tenantIdClaim = context.User.FindFirstValue("tenant_id");

        if (!string.IsNullOrWhiteSpace(firmaKodu) && int.TryParse(tenantIdClaim, out var tenantId))
        {
            var cacheKey = tenantId + "|" + firmaKodu;
            if (!Cache.TryGetValue(cacheKey, out var snap) || snap.Until <= DateTime.UtcNow)
            {
                var tenant = await masterDb.Tenants.AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == tenantId && t.FirmaKodu == firmaKodu);
                var connection = tenant is null ? "" : LiveConnection(store, tenant.DatabaseName, tenant.ConnectionString);
                snap = tenant is null
                    ? new TenantSnap(0, "", "", TenantStatus.Pending, DateTime.MinValue, DateTime.UtcNow.AddMinutes(1))
                    : new TenantSnap(tenant.Id, tenant.FirmaKodu, connection, tenant.Status, tenant.LicenseExpiresAt, DateTime.UtcNow.AddMinutes(10));
                Cache[cacheKey] = snap;
            }

            if (snap.Status == TenantStatus.Ready && snap.Id > 0)
            {
                if (snap.LicenseExpiresAt <= DateTime.UtcNow)
                {
                    context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        message = "Lisans süresi doldu. Devam etmek için yıllık ücreti ödemeniz gerekiyor."
                    });
                    return;
                }

                tenantContext.Set(snap.Id, snap.FirmaKodu, snap.ConnectionString);
            }
        }

        await next(context);
    }

    private static string LiveConnection(SqlServerSettingsStore store, string databaseName, string stored)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(databaseName))
                return store.ForDatabase(databaseName);
        }
        catch
        {
            /* kayıtlı bağlantıya düş */
        }

        return stored;
    }

    private sealed record TenantSnap(int Id, string FirmaKodu, string ConnectionString, TenantStatus Status, DateTime LicenseExpiresAt, DateTime Until);
}
