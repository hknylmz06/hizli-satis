using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

public record ExtraSettingsRequest(bool? AutoFiscalReceipt, bool? AskPosAccount);

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/settings/extra")]
public class ExtraSettingsController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var row = await LoadAsync(db, ct);
        return Ok(Map(row));
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] ExtraSettingsRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var row = await LoadAsync(db, ct);
        if (request.AutoFiscalReceipt is bool auto) row.AutoFiscalReceipt = auto;
        if (request.AskPosAccount is bool ask) row.AskPosAccount = ask;
        await db.SaveChangesAsync(ct);
        return Ok(Map(row));
    }

    private static async Task<AppSetting> LoadAsync(TenantDbContext db, CancellationToken ct)
    {
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var row = await db.Settings.FirstOrDefaultAsync(ct);
        if (row is not null) return row;
        row = new AppSetting { Id = 1, CompanyName = "", Currency = "TRY", DefaultVatRate = 20, AutoFiscalReceipt = true };
        db.Settings.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    private static object Map(AppSetting row) => new { autoFiscalReceipt = row.AutoFiscalReceipt, askPosAccount = row.AskPosAccount };
}
