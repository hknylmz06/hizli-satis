using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/definitions")]
public class DefinitionsController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet("departments")]
    public async Task<IActionResult> Departments(CancellationToken ct)
    {
        await using var db = await Open(ct);
        var items = await db.Departments.AsNoTracking()
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Color, x.VatRate })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] DepartmentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Departman adı zorunlu." });

        await using var db = await Open(ct);
        var name = request.Name.Trim();
        if (await db.Departments.AnyAsync(x => x.Name == name, ct))
            return BadRequest(new { message = "Bu departman zaten var." });

        var item = new Department
        {
            Name = name,
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#6366f1" : request.Color.Trim(),
            VatRate = request.VatRate,
            SortOrder = await db.Departments.CountAsync(ct)
        };
        db.Departments.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Name, item.Color, item.VatRate });
    }

    [HttpDelete("departments/{id:int}")]
    public async Task<IActionResult> DeleteDepartment(int id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var item = await db.Departments.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        var products = await db.Products.Where(p => p.DepartmentId == id).ToListAsync(ct);
        foreach (var product in products)
            product.DepartmentId = null;
        db.Departments.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("sizes")]
    public async Task<IActionResult> Sizes(CancellationToken ct)
    {
        await using var db = await Open(ct);
        var items = await db.SizeOptions.AsNoTracking()
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost("sizes")]
    public async Task<IActionResult> CreateSize([FromBody] NameRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Beden adı zorunlu." });

        await using var db = await Open(ct);
        var name = request.Name.Trim();
        if (await db.SizeOptions.AnyAsync(x => x.Name == name, ct))
            return BadRequest(new { message = "Bu beden zaten var." });

        var item = new SizeOption { Name = name, SortOrder = await db.SizeOptions.CountAsync(ct) };
        db.SizeOptions.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Name });
    }

    [HttpDelete("sizes/{id:int}")]
    public async Task<IActionResult> DeleteSize(int id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        if (await db.VariantOptions.AnyAsync(v => v.SizeOptionId == id, ct))
            return BadRequest(new { message = "Bu beden bir varyantta kullanılıyor. Önce varyantı sil." });
        var item = await db.SizeOptions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        db.SizeOptions.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("colors")]
    public async Task<IActionResult> Colors(CancellationToken ct)
    {
        await using var db = await Open(ct);
        var items = await db.ColorOptions.AsNoTracking()
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.Hex })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost("colors")]
    public async Task<IActionResult> CreateColor([FromBody] NameRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Renk adı zorunlu." });

        await using var db = await Open(ct);
        var name = request.Name.Trim();
        if (await db.ColorOptions.AnyAsync(x => x.Name == name, ct))
            return BadRequest(new { message = "Bu renk zaten var." });

        var item = new ColorOption
        {
            Name = name,
            Hex = string.IsNullOrWhiteSpace(request.Color) ? "#64748b" : request.Color.Trim(),
            SortOrder = await db.ColorOptions.CountAsync(ct)
        };
        db.ColorOptions.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.Name, item.Hex });
    }

    [HttpDelete("colors/{id:int}")]
    public async Task<IActionResult> DeleteColor(int id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        if (await db.VariantOptions.AnyAsync(v => v.ColorOptionId == id, ct))
            return BadRequest(new { message = "Bu renk bir varyantta kullanılıyor. Önce varyantı sil." });
        var item = await db.ColorOptions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        db.ColorOptions.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("variants")]
    public async Task<IActionResult> Variants(CancellationToken ct)
    {
        await using var db = await Open(ct);
        var items = await db.VariantOptions.AsNoTracking()
            .OrderBy(x => x.Size!.Name).ThenBy(x => x.Color!.Name)
            .Select(x => new
            {
                x.Id,
                x.SizeOptionId,
                x.ColorOptionId,
                SizeName = x.Size!.Name,
                ColorName = x.Color!.Name,
                ColorHex = x.Color.Hex
            })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost("variants")]
    public async Task<IActionResult> CreateVariant([FromBody] VariantRequest request, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var size = await db.SizeOptions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.SizeId, ct);
        var color = await db.ColorOptions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ColorId, ct);
        if (size is null || color is null)
            return BadRequest(new { message = "Beden ve renk seç." });
        if (await db.VariantOptions.AnyAsync(v => v.SizeOptionId == size.Id && v.ColorOptionId == color.Id, ct))
            return BadRequest(new { message = "Bu varyant zaten var." });

        var item = new VariantOption { SizeOptionId = size.Id, ColorOptionId = color.Id };
        db.VariantOptions.Add(item);
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.SizeOptionId, item.ColorOptionId, SizeName = size.Name, ColorName = color.Name, ColorHex = color.Hex });
    }

    [HttpDelete("variants/{id:int}")]
    public async Task<IActionResult> DeleteVariant(int id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var item = await db.VariantOptions.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item is null) return NotFound();
        db.VariantOptions.Remove(item);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<TenantDbContext> Open(CancellationToken ct)
    {
        var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        return db;
    }
}
