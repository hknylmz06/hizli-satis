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
[Route("api/categories")]
public class CategoriesController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureCategoriesAsync(db, ct);
        var items = await db.Categories.AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Color })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CategoryRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Kategori adı zorunlu." });

        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureCategoriesAsync(db, ct);
        var name = request.Name.Trim();
        if (await db.Categories.AnyAsync(c => c.Name == name, ct))
            return BadRequest(new { message = "Bu kategori zaten var." });

        var category = new ProductCategory
        {
            Name = name,
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#10b981" : request.Color.Trim()
        };
        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);
        return Ok(new { category.Id, category.Name, category.Color });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureCategoriesAsync(db, ct);
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null) return NotFound();

        var products = await db.Products.Where(p => p.CategoryId == id).ToListAsync(ct);
        foreach (var product in products)
            product.CategoryId = null;

        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
