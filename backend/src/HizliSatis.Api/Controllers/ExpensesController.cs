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
[Route("api/expenses")]
public class ExpensesController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    public record EntryRequest(Guid AccountId, Guid? CategoryId, string Type, decimal Amount, string? Note);
    public record CategoryRequest(string Name, string Type, string? Color);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? type, [FromQuery] Guid? accountId, [FromQuery] string? q, CancellationToken ct)
    {
        var (start, end) = Range(from, to);
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var rows = await BuildRows(db, start, end, ct);
        if (!string.IsNullOrWhiteSpace(type))
        {
            var wanted = type.Trim().ToLowerInvariant();
            rows = rows.Where(row => wanted switch
            {
                "sale" => row.Kind == "sale",
                "income" => row.Kind is "income" or "collection",
                "expense" => row.Kind is "expense" or "payout",
                _ => true
            }).ToList();
        }
        if (accountId is Guid account)
            rows = rows.Where(row => row.AccountId == account).ToList();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var needle = q.Trim();
            rows = rows.Where(row =>
                (row.Note?.Contains(needle, StringComparison.OrdinalIgnoreCase) ?? false) ||
                row.Category.Contains(needle, StringComparison.OrdinalIgnoreCase) ||
                row.AccountName.Contains(needle, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var income = rows.Where(row => row.Kind is "sale" or "income" or "collection").Sum(row => row.Gross);
        var expense = rows.Where(row => row.Kind is "expense" or "payout").Sum(row => row.Gross);
        var commission = rows.Sum(row => row.Commission);
        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            summary = new
            {
                income,
                expense,
                commission,
                net = income - expense - commission
            },
            items = rows.OrderByDescending(row => row.At).Take(500)
        });
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var rows = await db.ExpenseCategories.AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.Type).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.Type, c.Color })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost("categories")]
    public async Task<IActionResult> AddCategory([FromBody] CategoryRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Kategori adı gerekli." });
        var type = request.Type?.Equals("income", StringComparison.OrdinalIgnoreCase) == true ? "income" : "expense";
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var category = new ExpenseCategory
        {
            Name = request.Name.Trim(),
            Type = type,
            Color = string.IsNullOrWhiteSpace(request.Color) ? "#64748b" : request.Color.Trim()
        };
        db.ExpenseCategories.Add(category);
        await db.SaveChangesAsync(ct);
        return Ok(new { category.Id, category.Name, category.Type, category.Color });
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] EntryRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Geçerli bir tutar gir." });
        var type = request.Type?.Equals("income", StringComparison.OrdinalIgnoreCase) == true ? "income" : "expense";
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var account = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == request.AccountId && a.IsActive, ct);
        if (account is null)
            return BadRequest(new { message = "Kasa veya banka seç." });
        if (request.CategoryId is Guid categoryId && !await db.ExpenseCategories.AnyAsync(c => c.Id == categoryId, ct))
            return BadRequest(new { message = "Kategori bulunamadı." });

        var entry = new LedgerEntry
        {
            AccountId = account.Id,
            CategoryId = request.CategoryId,
            Type = type,
            Amount = request.Amount,
            Commission = 0,
            NetAmount = request.Amount,
            Note = string.IsNullOrWhiteSpace(request.Note) ? (type == "income" ? "Gelir kaydı" : "Gider kaydı") : request.Note.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        if (type == "income")
            account.Balance += entry.NetAmount;
        else
            account.Balance -= entry.Amount;
        db.LedgerEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return Ok(new { entry.Id });
    }

    private static async Task<List<LedgerRow>> BuildRows(Infrastructure.Persistence.TenantDbContext db, DateTime start, DateTime end, CancellationToken ct)
    {
        var accounts = await db.CashAccounts.AsNoTracking().Where(a => a.IsActive).ToListAsync(ct);
        var names = accounts.ToDictionary(a => a.Id, a => a.Name);
        var cash = accounts.FirstOrDefault(a => a.Type == "cash") ?? accounts.FirstOrDefault();
        var card = accounts.FirstOrDefault(a => a.Type is "pos" or "bank") ?? cash;
        var categories = await db.ExpenseCategories.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        var rows = new List<LedgerRow>();

        var sales = await db.Sales.AsNoTracking()
            .Where(s => s.SoldAt >= start && s.SoldAt < end && s.PaymentMethod != PaymentMethod.Veresiye)
            .ToListAsync(ct);
        foreach (var sale in sales)
        {
            var account = sale.PaymentMethod == PaymentMethod.KrediKarti ? card : cash;
            if (account is null) continue;
            var method = sale.PaymentMethod == PaymentMethod.KrediKarti ? "Kredi Kartı" : "Nakit";
            rows.Add(new LedgerRow(sale.SoldAt, "sale", "Satış Tahsilatı", account.Id, account.Name, $"POS Satış ({method} - {account.Name}): {sale.ReceiptNo}", sale.GrandTotal, 0, sale.GrandTotal));
        }

        var ledger = await db.LedgerEntries.AsNoTracking().Where(e => e.CreatedAt >= start && e.CreatedAt < end).ToListAsync(ct);
        foreach (var entry in ledger)
        {
            var category = entry.CategoryId is Guid id && categories.TryGetValue(id, out var name) ? name : (entry.Type == "income" ? "Gelir" : "Gider");
            rows.Add(new LedgerRow(entry.CreatedAt, entry.Type, entry.Type == "income" ? "Gelir" : "Gider", entry.AccountId, names.GetValueOrDefault(entry.AccountId) ?? "-", $"{category}: {entry.Note}", entry.Amount, entry.Commission, entry.NetAmount));
        }

        var collected = await db.CustomerPayments.AsNoTracking()
            .Where(p => p.PaidAt >= start && p.PaidAt < end && (p.Kind == null || p.Kind == "payment") && p.AccountId != null)
            .ToListAsync(ct);
        foreach (var payment in collected)
        {
            var account = payment.AccountId!.Value;
            rows.Add(new LedgerRow(payment.PaidAt, "collection", "Tahsilat", account, names.GetValueOrDefault(account) ?? "-", payment.Note ?? "Veresiye tahsilatı", payment.Amount, 0, payment.Amount));
        }

        var paid = await db.SupplierPayments.AsNoTracking()
            .Where(p => p.PaidAt >= start && p.PaidAt < end && p.Kind == "payment" && p.AccountId != null)
            .ToListAsync(ct);
        foreach (var payment in paid)
        {
            var account = payment.AccountId!.Value;
            rows.Add(new LedgerRow(payment.PaidAt, "payout", "Gider", account, names.GetValueOrDefault(account) ?? "-", payment.Note ?? "Tedarikçi ödemesi", payment.Amount, 0, payment.Amount));
        }

        var invoices = await db.PurchaseInvoices.AsNoTracking()
            .Where(p => p.PurchasedAt >= start && p.PurchasedAt < end && p.PaymentKind == "cash" && p.AccountId != null)
            .ToListAsync(ct);
        foreach (var invoice in invoices)
        {
            var account = invoice.AccountId!.Value;
            rows.Add(new LedgerRow(invoice.PurchasedAt, "expense", "Gider", account, names.GetValueOrDefault(account) ?? "-", $"Alış faturası {invoice.InvoiceNo}", invoice.Total, 0, invoice.Total));
        }

        return rows;
    }

    private static (DateTime start, DateTime end) Range(DateTime? from, DateTime? to)
    {
        var start = (from ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1)).Date;
        var end = (to ?? DateTime.UtcNow).Date.AddDays(1);
        if (end <= start) end = start.AddDays(1);
        return (start, end);
    }

    private sealed record LedgerRow(DateTime At, string Kind, string KindLabel, Guid AccountId, string AccountName, string Category, decimal Gross, decimal Commission, decimal Net)
    {
        public string? Note => Category;
    }
}
