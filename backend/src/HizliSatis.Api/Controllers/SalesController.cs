using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Enums;
using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Services;
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
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var actorName = User.Identity?.Name;
        var actor = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == actorName, ct);
        if (paymentMethod == PaymentMethod.Veresiye && !TenantAccess.Allows(actor, "can_credit_sale"))
            return BadRequest(new { message = "Veresiye satış yetkin yok." });
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var productIds = request.Items.Where(i => i.ProductId is Guid).Select(i => i.ProductId!.Value).Distinct().ToList();
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
        var variants = await db.ProductVariants.Where(v => productIds.Contains(v.ProductId)).ToListAsync(ct);

        foreach (var line in request.Items)
        {
            if (line.Quantity <= 0)
                return BadRequest(new { message = "Miktar 0'dan büyük olmalı." });

            if (line.ProductId is null)
            {
                if (string.IsNullOrWhiteSpace(line.Name))
                    return BadRequest(new { message = "Departman adı gerekli." });
                if (line.UnitPrice is not > 0)
                    return BadRequest(new { message = "Departman tutarı 0'dan büyük olmalı." });

                var vat = line.VatRate.GetValueOrDefault(20);
                if (vat < 0) vat = 0;
                if (vat > 100) vat = 100;
                var unitPrice = line.UnitPrice.Value;
                var deptTotal = Math.Round(unitPrice * line.Quantity, 2);
                var deptVatAmount = Math.Round(deptTotal * vat / (100 + vat), 2);
                const decimal margin = 20m;
                var deptCost = Math.Round(deptTotal * (100 - margin) / 100, 2);
                var deptName = line.Name.Trim();
                if (deptName.Length > 200) deptName = deptName[..200];

                sale.Items.Add(new SaleItem
                {
                    ProductName = deptName,
                    Quantity = line.Quantity,
                    UnitPrice = unitPrice,
                    PurchasePrice = line.Quantity == 0 ? 0 : Math.Round(deptCost / line.Quantity, 2),
                    VatRate = vat,
                    LineTotal = deptTotal
                });
                subTotal += deptTotal - deptVatAmount;
                vatTotal += deptVatAmount;
                costTotal += deptCost;
                continue;
            }

            var product = products.First(p => p.Id == line.ProductId);
            var productVariants = variants.Where(v => v.ProductId == product.Id).ToList();
            ProductVariant? variant = null;
            if (line.VariantId is Guid variantId)
            {
                variant = productVariants.FirstOrDefault(v => v.Id == variantId);
                if (variant is null)
                    return BadRequest(new { message = $"{product.Name} için seçilen beden/renk bulunamadı." });
            }
            else if (productVariants.Count > 0)
            {
                return BadRequest(new { message = $"{product.Name} için beden ve renk seç." });
            }

            var lineTotal = Math.Round(product.SalePrice * line.Quantity, 2);
            var lineVat = Math.Round(lineTotal * product.VatRate / (100 + product.VatRate), 2);
            var lineNet = lineTotal - lineVat;

            var soldName = variant is null
                ? product.Name
                : $"{product.Name} · {variant.SizeName} {variant.ColorName}".Trim();
            var saleItem = new SaleItem
            {
                ProductId = product.Id,
                VariantId = variant?.Id,
                ProductName = soldName,
                Barcode = product.Barcode,
                Quantity = line.Quantity,
                UnitPrice = product.SalePrice,
                VatRate = product.VatRate,
                LineTotal = lineTotal
            };
            sale.Items.Add(saleItem);
            var onHand = variant?.StockQuantity ?? product.StockQuantity;
            var lineCost = await FifoStock.ConsumeAsync(db, saleItem, product, variant?.Id, onHand, ct);

            if (variant is not null)
                variant.StockQuantity -= line.Quantity;
            product.StockQuantity -= line.Quantity;
            subTotal += lineNet;
            vatTotal += lineVat;
            costTotal += lineCost;
        }

        sale.SubTotal = subTotal;
        sale.VatTotal = vatTotal;
        sale.GrandTotal = subTotal + vatTotal;
        sale.CostTotal = costTotal;

        var discount = request.DiscountAmount.GetValueOrDefault();
        if (discount < 0) discount = 0;
        if (discount > sale.GrandTotal) discount = sale.GrandTotal;
        if (discount > 0 && !TenantAccess.Allows(actor, "can_discount"))
            return BadRequest(new { message = "İskonto yetkin yok." });
        sale.GrandTotal -= discount;

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

    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> Void(Guid id, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var sale = await db.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sale is null) return NotFound(new { message = "Satış bulunamadı." });

        await FifoStock.RestoreAsync(db, sale.Items.Select(i => i.Id), ct);

        foreach (var item in sale.Items)
        {
            if (item.ProductId is Guid productId)
            {
                var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct);
                if (product is not null)
                    product.StockQuantity += item.Quantity;
            }
            if (item.VariantId is Guid variantId)
            {
                var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == variantId, ct);
                if (variant is not null)
                    variant.StockQuantity += item.Quantity;
            }
        }

        if (sale.PaymentMethod == PaymentMethod.Veresiye && sale.CustomerId is Guid customerId)
        {
            var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId, ct);
            if (customer is not null)
                customer.Balance -= sale.GrandTotal;
        }

        db.SaleItems.RemoveRange(sale.Items);
        db.Sales.Remove(sale);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new { voided = true, sale.ReceiptNo });
    }

    [HttpGet("recent")]
    public async Task<IActionResult> Recent(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
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
