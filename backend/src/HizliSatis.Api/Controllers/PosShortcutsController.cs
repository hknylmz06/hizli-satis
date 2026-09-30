using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/pos/shortcuts")]
public class PosShortcutsController(TenantDbContextFactory tenantDbFactory, MasterDbContext master) : ControllerBase
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
                Variants = p.Variants
                    .OrderBy(v => v.SizeName).ThenBy(v => v.ColorName)
                    .Select(v => new { v.Id, v.SizeName, v.ColorName, v.StockQuantity })
                    .ToList()
            })
            .ToListAsync(ct);
        var ordered = ids.Select(id => rows.FirstOrDefault(p => p.Id == id)).Where(p => p is not null).ToList();
        return Ok(new { ids = ordered.Select(p => p!.Id), products = ordered });
    }

    [HttpGet("images")]
    public async Task<IActionResult> Images(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var ids = await db.PosShortcuts.AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => x.ProductId)
            .ToListAsync(ct);
        if (ids.Count == 0) return Ok(Array.Empty<object>());

        var rows = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id) && p.IsActive)
            .Select(p => new { p.Id, p.Barcode, p.Image })
            .ToListAsync(ct);
        var codes = rows
            .Where(p => string.IsNullOrWhiteSpace(p.Image) && !string.IsNullOrWhiteSpace(p.Barcode))
            .Select(p => p.Barcode!)
            .Distinct()
            .ToList();
        var sharedRows = codes.Count == 0
            ? []
            : await master.CatalogProducts.AsNoTracking()
                .Where(c => codes.Contains(c.Barcode) && c.Image != null)
                .Select(c => new { c.Barcode, c.Image })
                .ToListAsync(ct);
        var shared = sharedRows
            .Where(c => !string.IsNullOrWhiteSpace(c.Image))
            .GroupBy(c => c.Barcode)
            .ToDictionary(g => g.Key, g => g.First().Image!);
        var photos = rows
            .Select(p => new
            {
                p.Id,
                image = string.IsNullOrWhiteSpace(p.Image) && p.Barcode is not null && shared.TryGetValue(p.Barcode, out var photo) ? photo : p.Image
            })
            .Where(p => !string.IsNullOrWhiteSpace(p.image));
        return Ok(photos);
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
