using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Services;
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
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] int? page, [FromQuery] int? pageSize, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var query = db.Products.AsNoTracking().Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(p =>
                p.Name.Contains(term) ||
                (p.Barcode != null && p.Barcode.Contains(term)));
        }

        var ordered = query.OrderBy(p => p.Name).Select(p => new
        {
            p.Id,
            p.Name,
            p.Barcode,
            p.PurchasePrice,
            p.SalePrice,
            p.VatRate,
            p.StockQuantity,
            p.Unit,
            p.OriginCountry,
            p.IsDomestic,
            p.UnitQty,
            p.UnitType,
            p.CriticalStockLevel,
            p.IsActive,
            p.CategoryId,
            CategoryName = p.Category != null ? p.Category.Name : null,
            CategoryColor = p.Category != null ? p.Category.Color : null,
            p.DepartmentId,
            DepartmentName = p.Department != null ? p.Department.Name : null,
            DepartmentColor = p.Department != null ? p.Department.Color : null,
            Variants = p.Variants
                .OrderBy(v => v.SizeName).ThenBy(v => v.ColorName)
                .Select(v => new { v.Id, v.SizeName, v.ColorName, v.StockQuantity })
                .ToList()
        });

        if (page is null)
            return Ok(await ordered.ToListAsync(ct));

        var size = pageSize is > 0 and <= 100 ? pageSize.Value : 100;
        var total = await query.CountAsync(ct);
        var pageCount = Math.Max(1, (int)Math.Ceiling(total / (double)size));
        var index = page.Value < 1 ? 1 : Math.Min(page.Value, pageCount);
        var items = await ordered.Skip((index - 1) * size).Take(size).ToListAsync(ct);
        return Ok(new { total, page = index, pageSize = size, pageCount, items });
    }

    [HttpGet("by-barcode/{barcode}")]
    public async Task<IActionResult> ByBarcode(string barcode, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var product = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && p.Barcode == barcode)
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
            .FirstOrDefaultAsync(ct);
        return product is null ? NotFound(new { message = "Ürün bulunamadı." }) : Ok(product);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ProductRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var product = new Product
        {
            Name = request.Name.Trim(),
            Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim(),
            CategoryId = request.CategoryId,
            DepartmentId = request.DepartmentId,
            PurchasePrice = request.PurchasePrice,
            SalePrice = request.SalePrice,
            VatRate = request.VatRate,
            StockQuantity = request.StockQuantity,
            CriticalStockLevel = request.CriticalStockLevel
        };
        ApplyLabel(product, request);
        SyncVariants(product, request, replace: false);
        FifoStock.AddOpening(db, product);
        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        return Ok(Shape(product));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ProductRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var product = await db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == id && p.IsActive, ct);
        if (product is null) return NotFound();

        product.Name = request.Name.Trim();
        product.Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        product.CategoryId = request.CategoryId;
        product.DepartmentId = request.DepartmentId;
        product.PurchasePrice = request.PurchasePrice;
        product.SalePrice = request.SalePrice;
        product.VatRate = request.VatRate;
        product.StockQuantity = request.StockQuantity;
        product.CriticalStockLevel = request.CriticalStockLevel;
        ApplyLabel(product, request);
        SyncVariants(product, request, replace: true);
        await db.SaveChangesAsync(ct);
        return Ok(Shape(product));
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

    private static void ApplyLabel(Product product, ProductRequest request)
    {
        product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? "Adet" : request.Unit.Trim();
        product.OriginCountry = string.IsNullOrWhiteSpace(request.OriginCountry) ? null : request.OriginCountry.Trim();
        product.IsDomestic = request.IsDomestic;
        product.UnitQty = request.UnitQty <= 0 ? 1 : request.UnitQty;
        product.UnitType = string.IsNullOrWhiteSpace(request.UnitType) ? "Adet" : request.UnitType.Trim();
    }

    private static void SyncVariants(Product product, ProductRequest request, bool replace)
    {
        var lines = (request.Variants ?? [])
            .Where(v => !string.IsNullOrWhiteSpace(v.Size) || !string.IsNullOrWhiteSpace(v.Color))
            .ToList();
        if (!replace)
        {
            if (lines.Count == 0) return;
            foreach (var line in lines)
            {
                product.Variants.Add(new ProductVariant
                {
                    SizeName = line.Size?.Trim() ?? "",
                    ColorName = line.Color?.Trim() ?? "",
                    StockQuantity = line.StockQuantity
                });
            }
            product.StockQuantity = lines.Sum(v => v.StockQuantity);
            return;
        }

        var used = new HashSet<ProductVariant>();
        foreach (var line in lines)
        {
            var size = line.Size?.Trim() ?? "";
            var color = line.Color?.Trim() ?? "";
            var match = product.Variants.FirstOrDefault(v => !used.Contains(v) && v.SizeName == size && v.ColorName == color);
            if (match is null)
            {
                match = new ProductVariant { SizeName = size, ColorName = color, StockQuantity = line.StockQuantity };
                product.Variants.Add(match);
            }
            else
            {
                match.StockQuantity = line.StockQuantity;
            }
            used.Add(match);
        }

        foreach (var extra in product.Variants.Where(v => !used.Contains(v)).ToList())
            product.Variants.Remove(extra);

        if (lines.Count > 0)
            product.StockQuantity = lines.Sum(v => v.StockQuantity);
    }

    private static object Shape(Product product) => new
    {
        product.Id,
        product.Name,
        product.Barcode,
        product.PurchasePrice,
        product.SalePrice,
        product.VatRate,
        product.StockQuantity,
        product.CriticalStockLevel,
        product.IsActive,
        product.CategoryId,
        product.DepartmentId,
        product.Unit,
        product.OriginCountry,
        product.IsDomestic,
        product.UnitQty,
        product.UnitType
    };
}
