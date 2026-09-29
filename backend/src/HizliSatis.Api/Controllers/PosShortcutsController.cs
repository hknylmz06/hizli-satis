using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/pos/shortcuts")]
public class PosShortcutsController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    public record SaveRequest(List<int>? ProductIds);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var ids = await db.PosShortcuts.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => x.ProductId)
            .ToListAsync(ct);
        var rows = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.IsActive)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Barcode,
                p.SalePrice,
                p.VatRate,
                p.StockQuantity,
                p.Unit,
                p.Image,
                Variants = p.Variants
                    .OrderBy(v => v.SizeName).ThenBy(v => v.ColorName)
                    .Select(v => new { v.Id, v.SizeName, v.ColorName, v.StockQuantity })
                    .ToList()
            })
            .ToListAsync(ct);
        var products = ids.Select(id => rows.FirstOrDefault(p => p.Id == id)).Where(p => p is not null).ToList();
        return Ok(new { ids = products.Select(p => p!.Id), products });
    }

    [HttpPut]
    public async Task<IActionResult> Save([FromBody] SaveRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var ids = (request.ProductIds ?? [])
            .Where(id => id > 0)
            .Distinct()
            .ToList();
        var existing = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.IsActive)
            .Select(p => p.Id)
            .ToListAsync(ct);
        var ordered = ids.Where(existing.Contains).ToList();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.PosShortcuts.ExecuteDeleteAsync(ct);
        for (var i = 0; i < ordered.Count; i++)
            db.PosShortcuts.Add(new Domain.Tenant.PosShortcut { ProductId = ordered[i], SortOrder = i });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(ordered);
    }
}
