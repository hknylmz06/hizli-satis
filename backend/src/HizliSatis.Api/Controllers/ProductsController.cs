using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/products")]
public class ProductsController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var query = db.Products.AsNoTracking().Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(p =>
                p.Name.Contains(term) ||
                (p.Barcode != null && p.Barcode.Contains(term)));
        }

        var items = await query.OrderBy(p => p.Name).ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("by-barcode/{barcode}")]
    public async Task<IActionResult> ByBarcode(string barcode, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.IsActive && p.Barcode == barcode, ct);
        return product is null ? NotFound(new { message = "Ürün bulunamadı." }) : Ok(product);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var product = new Product
        {
            Name = request.Name.Trim(),
            Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim(),
            PurchasePrice = request.PurchasePrice,
            SalePrice = request.SalePrice,
            VatRate = request.VatRate,
            StockQuantity = request.StockQuantity,
            CriticalStockLevel = request.CriticalStockLevel
        };
        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        return Ok(product);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();

        product.Name = request.Name.Trim();
        product.Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        product.PurchasePrice = request.PurchasePrice;
        product.SalePrice = request.SalePrice;
        product.VatRate = request.VatRate;
        product.StockQuantity = request.StockQuantity;
        product.CriticalStockLevel = request.CriticalStockLevel;
        await db.SaveChangesAsync(ct);
        return Ok(product);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();
        product.IsActive = false;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
