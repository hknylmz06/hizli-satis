using System.Security.Claims;
using HizliSatis.Domain.Enums;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Middleware;

public class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext, MasterDbContext masterDb)
    {
        var firmaKodu = context.User.FindFirstValue("firma_kodu");
        var tenantIdClaim = context.User.FindFirstValue("tenant_id");

        if (!string.IsNullOrWhiteSpace(firmaKodu) && int.TryParse(tenantIdClaim, out var tenantId))
        {
            var tenant = await masterDb.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == tenantId && t.FirmaKodu == firmaKodu);

            if (tenant is { Status: TenantStatus.Ready })
            {
                if (!tenant.IsLicenseActive())
                {
                    context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        message = "Lisans süresi doldu. Devam etmek için yıllık ücreti ödemeniz gerekiyor."
                    });
                    return;
                }

                tenantContext.Set(tenant.Id, tenant.FirmaKodu, tenant.ConnectionString);
            }
        }

        await next(context);
    }
}
