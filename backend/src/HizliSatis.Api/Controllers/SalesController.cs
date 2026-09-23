using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Enums;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/sales")]
public class SalesController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSaleRequest request, CancellationToken ct)
    {
        if (request.Items is null || request.Items.Count == 0)
            return BadRequest(new { message = "Sepet boş olamaz." });

        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
            return BadRequest(new { message = "Ödeme tipi Nakit, KrediKarti veya Veresiye olmalı." });

        if (paymentMethod == PaymentMethod.Veresiye && request.CustomerId is null)
            return BadRequest(new { message = "Veresiye satış için cari seçilmeli." });

        await using var db = tenantDbFactory.Create();
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.Where(p => productIds.Contains(p.Id) && p.IsActive).ToListAsync(ct);
        if (products.Count != productIds.Count)
            return BadRequest(new { message = "Bazı ürünler bulunamadı." });

        Customer? customer = null;
        if (request.CustomerId is Guid customerId)
        {
            customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId, ct);
            if (customer is null)
                return BadRequest(new { message = "Cari bulunamadı." });
        }

        var sale = new Sale
        {
            ReceiptNo = $"S{DateTime.UtcNow:yyyyMMddHHmmss}{Random.Shared.Next(100, 999)}",
            PaymentMethod = paymentMethod,
            CustomerId = customer?.Id,
            CashierUsername = User.Identity?.Name
        };

        decimal subTotal = 0, vatTotal = 0, costTotal = 0;

        foreach (var line in request.Items)
        {
            if (line.Quantity <= 0)
                return BadRequest(new { message = "Miktar 0'dan büyük olmalı." });

            var product = products.First(p => p.Id == line.ProductId);
            if (product.StockQuantity < line.Quantity)
                return BadRequest(new { message = $"{product.Name} için yetersiz stok." });

            var lineTotal = Math.Round(product.SalePrice * line.Quantity, 2);
            var lineVat = Math.Round(lineTotal * product.VatRate / (100 + product.VatRate), 2);
            var lineNet = lineTotal - lineVat;

            sale.Items.Add(new SaleItem
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Barcode = product.Barcode,
                Quantity = line.Quantity,
                UnitPrice = product.SalePrice,
                PurchasePrice = product.PurchasePrice,
                VatRate = product.VatRate,
                LineTotal = lineTotal
            });

            product.StockQuantity -= line.Quantity;
            subTotal += lineNet;
            vatTotal += lineVat;
            costTotal += Math.Round(product.PurchasePrice * line.Quantity, 2);
        }

        sale.SubTotal = subTotal;
        sale.VatTotal = vatTotal;
        sale.GrandTotal = subTotal + vatTotal;
        sale.CostTotal = costTotal;

        if (paymentMethod == PaymentMethod.Veresiye && customer is not null)
            customer.Balance += sale.GrandTotal;

        db.Sales.Add(sale);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return Ok(new
        {
            sale.Id,
            sale.ReceiptNo,
            sale.SoldAt,
            PaymentMethod = sale.PaymentMethod.ToString(),
            sale.SubTotal,
            sale.VatTotal,
            sale.GrandTotal,
            Profit = sale.GrandTotal - sale.CostTotal,
            Items = sale.Items.Select(i => new
            {
                i.ProductName,
                i.Quantity,
                i.UnitPrice,
                i.LineTotal
            })
        });
    }

    [HttpGet("recent")]
    public async Task<IActionResult> Recent(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var items = await db.Sales.AsNoTracking()
            .OrderByDescending(s => s.SoldAt)
            .Take(20)
            .Select(s => new
            {
                s.Id,
                s.ReceiptNo,
                s.SoldAt,
                PaymentMethod = s.PaymentMethod.ToString(),
                s.GrandTotal
            })
            .ToListAsync(ct);
        return Ok(items);
    }
}
