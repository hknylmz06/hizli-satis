using HizliSatis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/catalog")]
public class CatalogController(MasterDbContext master) : ControllerBase
{
    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> ByBarcode(string barcode, CancellationToken ct)
    {
        var code = barcode.Trim();
        if (code.Length < 3)
            return NotFound(new { message = "Katalogda yok." });

        var row = await master.CatalogProducts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Barcode == code, ct);
        if (row is null)
            return NotFound(new { message = "Katalogda yok." });

        return Ok(new
        {
            row.Barcode,
            row.Name,
            salePrice = row.SalePrice,
            vatRate = row.VatRate,
            row.Unit,
            categoryName = row.CategoryName,
            fromCatalog = true
        });
    }
}
