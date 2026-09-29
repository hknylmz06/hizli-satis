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
[Route("api/purchases")]
public class PurchasesController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var items = await db.PurchaseInvoices.AsNoTracking()
            .OrderByDescending(p => p.PurchasedAt)
            .Take(40)
            .Select(p => new
            {
                p.Id,
                p.InvoiceNo,
                p.SupplierName,
                p.PurchasedAt,
                p.Total,
                p.PaymentKind,
                Lines = p.Lines.Select(l => new { l.ProductName, l.Quantity, l.UnitCost, l.LineTotal }).ToList()
            })
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PurchaseRequest request, CancellationToken ct)
    {
        if (request.Lines is null || request.Lines.Count == 0)
            return BadRequest(new { message = "Faturada ürün satırı yok." });
        if (request.Lines.Any(l => l.Quantity <= 0))
            return BadRequest(new { message = "Miktar 0'dan büyük olmalı." });
        if (request.Lines.Any(l => l.UnitCost < 0))
            return BadRequest(new { message = "Alış fiyatı eksi olamaz." });

        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var productIds = request.Lines.Select(l => l.ProductId).Distinct().ToList();
        var products = await db.Products.Where(p => productIds.Contains(p.Id) && p.IsActive).ToListAsync(ct);
        if (products.Count != productIds.Count)
            return BadRequest(new { message = "Bazı ürünler bulunamadı." });
        var variants = await db.ProductVariants.Where(v => productIds.Contains(v.ProductId)).ToListAsync(ct);

        var purchasedAt = request.PurchasedAt ?? DateTime.UtcNow;
        var invoice = new PurchaseInvoice
        {
            InvoiceNo = string.IsNullOrWhiteSpace(request.InvoiceNo)
                ? $"A{DateTime.UtcNow:yyyyMMddHHmmss}"
                : request.InvoiceNo.Trim(),
            SupplierName = string.IsNullOrWhiteSpace(request.SupplierName) ? null : request.SupplierName.Trim(),
            PurchasedAt = purchasedAt
        };

        foreach (var line in request.Lines)
        {
            var product = products.First(p => p.Id == line.ProductId);
            var productVariants = variants.Where(v => v.ProductId == product.Id).ToList();
            ProductVariant? variant = null;
            if (line.VariantId is int variantId)
            {
                variant = productVariants.FirstOrDefault(v => v.Id == variantId);
                if (variant is null)
                    return BadRequest(new { message = $"{product.Name} için beden/renk bulunamadı." });
            }
            else if (productVariants.Count > 0)
            {
                return BadRequest(new { message = $"{product.Name} için beden ve renk seç." });
            }

            var name = variant is null
                ? product.Name
                : $"{product.Name} · {variant.SizeName} {variant.ColorName}".Trim();
            var lineTotal = Math.Round(line.Quantity * line.UnitCost, 2);
            invoice.Lines.Add(new PurchaseInvoiceLine
            {
                ProductId = product.Id,
                VariantId = variant?.Id,
                ProductName = name,
                Quantity = line.Quantity,
                UnitCost = line.UnitCost,
                LineTotal = lineTotal
            });

            var batch = new StockBatch
            {
                ProductId = product.Id,
                VariantId = variant?.Id,
                PurchasedAt = purchasedAt,
                InitialQuantity = line.Quantity,
                RemainingQuantity = line.Quantity,
                UnitCost = line.UnitCost,
                Source = "Alis",
                Note = invoice.InvoiceNo
            };
            db.StockBatches.Add(batch);
            await FifoStock.ReceiveAsync(db, batch, product.Id, variant?.Id, ct);

            product.StockQuantity += line.Quantity;
            product.PurchasePrice = line.UnitCost;
            if (variant is not null)
                variant.StockQuantity += line.Quantity;
            invoice.Total += lineTotal;
        }

        var payCash = string.Equals(request.PaymentKind, "cash", StringComparison.OrdinalIgnoreCase);
        invoice.PaymentKind = payCash ? "cash" : "debt";
        if (payCash)
        {
            if (request.AccountId is null)
                return BadRequest(new { message = "Kasadan ödemek için kasa seç." });
            var account = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == request.AccountId && a.IsActive, ct);
            if (account is null)
                return BadRequest(new { message = "Kasa bulunamadı." });
            account.Balance -= invoice.Total;
            invoice.AccountId = account.Id;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(invoice.SupplierName))
                return BadRequest(new { message = "Borç yazmak için tedarikçi adı gir." });
            var supplierName = invoice.SupplierName.Trim();
            var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Name == supplierName, ct);
            if (supplier is null)
            {
                supplier = new Supplier { Name = supplierName };
                db.Suppliers.Add(supplier);
            }
            supplier.Balance += invoice.Total;
            db.SupplierPayments.Add(new SupplierPayment
            {
                SupplierId = supplier.Id,
                Amount = invoice.Total,
                Kind = "debt",
                Note = $"Alış faturası {invoice.InvoiceNo}"
            });
        }

        db.PurchaseInvoices.Add(invoice);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Ok(new { invoice.Id, invoice.InvoiceNo, invoice.Total });
    }
}
