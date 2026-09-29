using HizliSatis.Domain.Enums;
using HizliSatis.Infrastructure.Services;
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

    [HttpGet("overview")]
    public async Task<IActionResult> Overview([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var start = (from ?? DateTime.UtcNow.Date.AddDays(-6)).Date;
        var end = (to ?? DateTime.UtcNow).Date.AddDays(1);
        if (end <= start) end = start.AddDays(1);

        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);

        var sales = await db.Sales.AsNoTracking()
            .Include(s => s.Items)
            .Where(s => s.SoldAt >= start && s.SoldAt < end)
            .ToListAsync(ct);
        var products = await db.Products.AsNoTracking()
            .Include(p => p.Category)
            .Where(p => p.IsActive)
            .ToListAsync(ct);
        var accounts = await db.CashAccounts.AsNoTracking().Where(a => a.IsActive).OrderBy(a => a.Name).ToListAsync(ct);
        var collected = await db.CustomerPayments.AsNoTracking()
            .Where(p => p.PaidAt >= start && p.PaidAt < end && (p.Kind == null || p.Kind == "payment"))
            .ToListAsync(ct);
        var paidOut = await db.SupplierPayments.AsNoTracking()
            .Where(p => p.PaidAt >= start && p.PaidAt < end && p.Kind == "payment")
            .ToListAsync(ct);

        var users = await db.Users.AsNoTracking().ToListAsync(ct);
        var categoryByProduct = products.ToDictionary(p => p.Id, p => p.Category?.Name ?? "Kategorisiz");
        var accountNames = accounts.ToDictionary(a => a.Id, a => a.Name);

        var days = new List<object>();
        for (var day = start; day < end; day = day.AddDays(1))
        {
            var next = day.AddDays(1);
            var bucket = sales.Where(s => s.SoldAt >= day && s.SoldAt < next).ToList();
            var revenue = bucket.Sum(s => s.GrandTotal);
            var cost = bucket.Sum(s => s.CostTotal);
            days.Add(new { date = day, revenue, cost, profit = revenue - cost, count = bucket.Count });
        }

        var productById = products.ToDictionary(p => p.Id);
        var productSales = sales.SelectMany(s => s.Items.Select(i => new { Sale = s, Item = i }))
            .GroupBy(x => x.Item.ProductId?.ToString() ?? x.Item.ProductName)
            .Select(g =>
            {
                var first = g.First().Item;
                var product = first.ProductId is int id && productById.TryGetValue(id, out var found) ? found : null;
                var qty = g.Sum(x => x.Item.Quantity);
                var revenue = g.Sum(x => x.Item.LineTotal);
                var cost = g.Sum(x => x.Item.PurchasePrice * x.Item.Quantity);
                var profit = revenue - cost;
                var category = first.ProductId is int productId && categoryByProduct.TryGetValue(productId, out var categoryName)
                    ? categoryName
                    : "Genel";
                return new
                {
                    name = first.ProductName,
                    barcode = first.Barcode ?? product?.Barcode,
                    category,
                    unit = string.IsNullOrWhiteSpace(product?.Unit) ? "Adet" : product!.Unit,
                    quantity = qty,
                    revenue,
                    cost,
                    profit,
                    margin = revenue == 0 ? 0 : Math.Round(profit / revenue * 100, 0),
                    cashiers = g.GroupBy(x => string.IsNullOrWhiteSpace(x.Sale.CashierUsername) ? "" : x.Sale.CashierUsername)
                        .Select(c => new
                        {
                            username = string.IsNullOrEmpty(c.Key) ? "sistem" : c.Key,
                            quantity = c.Sum(x => x.Item.Quantity),
                            revenue = c.Sum(x => x.Item.LineTotal),
                            cost = c.Sum(x => x.Item.PurchasePrice * x.Item.Quantity)
                        })
                        .ToList()
                };
            })
            .OrderByDescending(x => x.revenue)
            .ToList();

        var categorySales = sales.SelectMany(s => s.Items)
            .GroupBy(i => i.ProductId is int id && categoryByProduct.TryGetValue(id, out var name) ? name : i.ProductId is null ? "Departman" : "Kategorisiz")
            .Select(g =>
            {
                var qty = g.Sum(x => x.Quantity);
                var revenue = g.Sum(x => x.LineTotal);
                var cost = g.Sum(x => x.PurchasePrice * x.Quantity);
                return new { name = g.Key, quantity = qty, revenue, cost, profit = revenue - cost };
            })
            .OrderByDescending(x => x.revenue)
            .ToList();

        var hours = Enumerable.Range(0, 24).Select(hour =>
        {
            var bucket = sales.Where(s => ((s.SoldAt.Hour + 3) % 24) == hour).ToList();
            return new { hour, total = bucket.Sum(s => s.GrandTotal), count = bucket.Count };
        }).ToList();

        var revenueTotal = sales.Sum(s => s.GrandTotal);
        var costTotal = sales.Sum(s => s.CostTotal);
        var stockItems = products
            .Select(p => new
            {
                p.Name,
                p.Barcode,
                stock = p.StockQuantity,
                critical = p.CriticalStockLevel,
                purchasePrice = p.PurchasePrice,
                salePrice = p.SalePrice,
                stockValue = Math.Round(p.StockQuantity * p.PurchasePrice, 2),
                category = p.Category?.Name ?? "Kategorisiz",
                low = p.StockQuantity <= p.CriticalStockLevel
            })
            .OrderBy(p => p.stock)
            .ToList();

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            saleCount = sales.Count,
            kasa = new
            {
                accounts = accounts.Select(a => new { a.Name, a.Type, a.Balance }),
                totalBalance = accounts.Sum(a => a.Balance),
                salesByMethod = sales.GroupBy(s => MethodName(s.PaymentMethod))
                    .Select(g => new { method = g.Key, total = g.Sum(x => x.GrandTotal), count = g.Count() })
                    .OrderByDescending(x => x.total),
                collected = collected.Sum(p => p.Amount),
                paidOut = paidOut.Sum(p => p.Amount),
                discount = sales.Sum(s => Math.Max(0, s.SubTotal + s.VatTotal - s.GrandTotal)),
                cashiers = sales.GroupBy(s => string.IsNullOrWhiteSpace(s.CashierUsername) ? "" : s.CashierUsername)
                    .Select(g =>
                    {
                        var user = users.FirstOrDefault(u => u.Username == g.Key);
                        var revenue = g.Sum(s => s.GrandTotal);
                        var cost = g.Sum(s => s.CostTotal);
                        return new
                        {
                            username = string.IsNullOrEmpty(g.Key) ? "sistem" : g.Key,
                            name = user?.DisplayName ?? (string.IsNullOrEmpty(g.Key) ? "Sistem" : g.Key),
                            role = user?.Role ?? "-",
                            count = g.Count(),
                            cash = g.Sum(s => s.CashAmount),
                            card = g.Sum(s => s.CardAmount),
                            credit = g.Where(s => s.PaymentMethod == PaymentMethod.Veresiye).Sum(s => s.GrandTotal),
                            partial = g.Where(s => s.PaymentMethod == PaymentMethod.Parcali).Sum(s => s.GrandTotal),
                            revenue,
                            discount = g.Sum(s => Math.Max(0, s.SubTotal + s.VatTotal - s.GrandTotal)),
                            cost,
                            profit = revenue - cost
                        };
                    })
                    .OrderByDescending(x => x.revenue)
                    .ToList(),
                movements = collected.Select(p => new
                {
                    at = p.PaidAt,
                    direction = "in",
                    amount = p.Amount,
                    note = p.Note ?? "Müşteri tahsilatı",
                    accountName = p.AccountId is int id && accountNames.TryGetValue(id, out var name) ? name : null
                }).Concat(paidOut.Select(p => new
                {
                    at = p.PaidAt,
                    direction = "out",
                    amount = p.Amount,
                    note = p.Note ?? "Tedarikçi ödemesi",
                    accountName = p.AccountId is int id && accountNames.TryGetValue(id, out var name) ? name : null
                })).OrderByDescending(x => x.at).Take(1000)
            },
            kar = new
            {
                revenue = revenueTotal,
                cost = costTotal,
                profit = revenueTotal - costTotal,
                margin = revenueTotal == 0 ? 0 : Math.Round((revenueTotal - costTotal) / revenueTotal * 100, 1),
                days
            },
            stok = new
            {
                skuCount = stockItems.Count,
                stockValue = stockItems.Sum(p => p.stockValue),
                lowCount = stockItems.Count(p => p.low),
                items = stockItems
            },
            products = productSales,
            categories = categorySales,
            hours
        });
    }

    private static string MethodName(HizliSatis.Domain.Enums.PaymentMethod method) => method switch
    {
        HizliSatis.Domain.Enums.PaymentMethod.KrediKarti => "Kredi kartı",
        HizliSatis.Domain.Enums.PaymentMethod.Veresiye => "Veresiye",
        HizliSatis.Domain.Enums.PaymentMethod.Parcali => "Parçalı",
        _ => "Nakit"
    };
}
