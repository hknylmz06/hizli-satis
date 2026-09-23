using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/reports")]
public class ReportsController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet("daily")]
    public async Task<IActionResult> Daily([FromQuery] DateTime? date, CancellationToken ct)
    {
        var day = (date ?? DateTime.UtcNow).Date;
        var next = day.AddDays(1);

        await using var db = tenantDbFactory.Create();
        var sales = await db.Sales.AsNoTracking()
            .Include(s => s.Items)
            .Where(s => s.SoldAt >= day && s.SoldAt < next)
            .ToListAsync(ct);

        var ciro = sales.Sum(s => s.GrandTotal);
        var maliyet = sales.Sum(s => s.CostTotal);
        var kar = ciro - maliyet;

        var topProducts = sales
            .SelectMany(s => s.Items)
            .GroupBy(i => i.ProductName)
            .Select(g => new
            {
                ProductName = g.Key,
                Quantity = g.Sum(x => x.Quantity),
                Revenue = g.Sum(x => x.LineTotal)
            })
            .OrderByDescending(x => x.Quantity)
            .Take(10)
            .ToList();

        var byPayment = sales
            .GroupBy(s => s.PaymentMethod.ToString())
            .Select(g => new { Method = g.Key, Total = g.Sum(x => x.GrandTotal), Count = g.Count() })
            .ToList();

        return Ok(new
        {
            Date = day,
            SaleCount = sales.Count,
            Ciro = ciro,
            Maliyet = maliyet,
            Kar = kar,
            ByPayment = byPayment,
            TopProducts = topProducts
        });
    }
}
