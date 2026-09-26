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
[Route("api/suppliers")]
public class SuppliersController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var query = db.Suppliers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(s => s.Name.Contains(term) || (s.Phone != null && s.Phone.Contains(term)));
        }

        var suppliers = await query.OrderBy(s => s.Name).ToListAsync(ct);
        var invoices = await db.PurchaseInvoices.AsNoTracking()
            .Select(p => new { p.SupplierName, p.Total })
            .ToListAsync(ct);
        var totals = invoices
            .Where(p => !string.IsNullOrWhiteSpace(p.SupplierName))
            .GroupBy(p => p.SupplierName!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => (Count: g.Count(), Total: g.Sum(x => x.Total)),
                StringComparer.OrdinalIgnoreCase);

        return Ok(suppliers.Select(s =>
        {
            totals.TryGetValue(s.Name.Trim(), out var hit);
            return new
            {
                s.Id,
                s.Name,
                s.Phone,
                s.Email,
                s.Address,
                s.Note,
                s.Balance,
                invoiceCount = hit.Count,
                totalPurchaseAmount = hit.Total
            };
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveSupplierRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tedarikçi adı zorunlu." });

        await using var db = await Open(ct);
        var name = request.Name.Trim();
        if (await db.Suppliers.AnyAsync(s => s.Name == name, ct))
            return BadRequest(new { message = "Bu tedarikçi zaten var." });

        var supplier = new Supplier
        {
            Name = name,
            Phone = Clean(request.Phone),
            Email = Clean(request.Email),
            Address = Clean(request.Address),
            Note = Clean(request.Note)
        };
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync(ct);
        return Ok(Map(supplier, 0, 0));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveSupplierRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Tedarikçi adı zorunlu." });

        await using var db = await Open(ct);
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier is null) return NotFound(new { message = "Tedarikçi bulunamadı." });
        supplier.Name = request.Name.Trim();
        supplier.Phone = Clean(request.Phone);
        supplier.Email = Clean(request.Email);
        supplier.Address = Clean(request.Address);
        supplier.Note = Clean(request.Note);
        await db.SaveChangesAsync(ct);
        return Ok(Map(supplier, 0, 0));
    }

    [HttpPost("{id:guid}/debt")]
    public async Task<IActionResult> AddDebt(Guid id, [FromBody] CustomerPaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Borç tutarı 0'dan büyük olmalı." });
        if (string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Borç için açıklama yaz." });

        await using var db = await Open(ct);
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier is null) return NotFound(new { message = "Tedarikçi bulunamadı." });

        supplier.Balance += request.Amount;
        db.SupplierPayments.Add(new SupplierPayment
        {
            SupplierId = supplier.Id,
            Amount = request.Amount,
            Kind = "debt",
            Note = request.Note.Trim()
        });
        await db.SaveChangesAsync(ct);
        return Ok(Map(supplier, 0, 0));
    }

    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] CustomerPaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Ödeme tutarı 0'dan büyük olmalı." });
        if (request.AccountId is null)
            return BadRequest(new { message = "Paranın çıkacağı kasayı seç." });

        await using var db = await Open(ct);
        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier is null) return NotFound(new { message = "Tedarikçi bulunamadı." });
        var account = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == request.AccountId && a.IsActive, ct);
        if (account is null) return BadRequest(new { message = "Kasa bulunamadı." });

        supplier.Balance -= request.Amount;
        account.Balance -= request.Amount;
        db.SupplierPayments.Add(new SupplierPayment
        {
            SupplierId = supplier.Id,
            AccountId = account.Id,
            Amount = request.Amount,
            Kind = "payment",
            Note = Clean(request.Note) ?? $"Ödeme · {account.Name}"
        });
        await db.SaveChangesAsync(ct);
        return Ok(Map(supplier, 0, 0));
    }

    [HttpGet("{id:guid}/statement")]
    public async Task<IActionResult> Statement(Guid id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier is null) return NotFound(new { message = "Tedarikçi bulunamadı." });

        var rows = await db.SupplierPayments.AsNoTracking()
            .Where(p => p.SupplierId == id)
            .OrderBy(p => p.PaidAt).ThenBy(p => p.Id)
            .ToListAsync(ct);
        var accountNames = await db.CashAccounts.AsNoTracking()
            .ToDictionaryAsync(a => a.Id, a => a.Name, ct);

        decimal running = 0, totalDebt = 0, totalPayments = 0;
        var transactions = new List<object>();
        foreach (var move in rows)
        {
            var kind = move.Kind == "debt" ? "debt" : "payment";
            if (kind == "payment")
            {
                running -= move.Amount;
                totalPayments += move.Amount;
            }
            else
            {
                running += move.Amount;
                totalDebt += move.Amount;
            }

            transactions.Add(new
            {
                move.Id,
                createdAt = move.PaidAt,
                type = kind,
                amount = move.Amount,
                note = move.Note,
                accountName = move.AccountId is Guid accountId && accountNames.TryGetValue(accountId, out var accountName) ? accountName : null,
                runningBalance = Math.Round(running, 2)
            });
        }

        transactions.Reverse();
        return Ok(new
        {
            supplier = Map(supplier, 0, 0),
            summary = new
            {
                currentBalance = supplier.Balance,
                totalDebt,
                totalPayments
            },
            transactions
        });
    }

    private async Task<TenantDbContext> Open(CancellationToken ct)
    {
        var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        return db;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static object Map(Supplier supplier, int invoiceCount, decimal totalPurchaseAmount) => new
    {
        supplier.Id,
        supplier.Name,
        supplier.Phone,
        supplier.Email,
        supplier.Address,
        supplier.Note,
        supplier.Balance,
        invoiceCount,
        totalPurchaseAmount
    };
}
