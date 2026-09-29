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
[Route("api/accounts")]
public class AccountsController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    public record AccountRequest(string Name, string Type, decimal Balance, decimal CommissionRate);
    public record TransferRequest(int FromAccountId, int ToAccountId, decimal Amount, string? Note);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var rows = await db.CashAccounts.AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.Name)
            .Select(a => new { a.Id, a.Name, a.Type, a.Balance, a.CommissionRate })
            .ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AccountRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Hesap adı gerekli." });
        var type = request.Type?.ToLowerInvariant() switch
        {
            "bank" => "bank",
            "pos" => "pos",
            _ => "cash"
        };
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var account = new CashAccount
        {
            Name = request.Name.Trim(),
            Type = type,
            Balance = request.Balance,
            CommissionRate = type == "pos" ? request.CommissionRate : 0,
            IsActive = true
        };
        db.CashAccounts.Add(account);
        await db.SaveChangesAsync(ct);
        return Ok(new { account.Id, account.Name, account.Type, account.Balance, account.CommissionRate });
    }

    [HttpPost("transfer")]
    public async Task<IActionResult> Transfer([FromBody] TransferRequest request, CancellationToken ct)
    {
        if (request.FromAccountId == request.ToAccountId)
            return BadRequest(new { message = "Çıkış ve varış hesabı aynı olamaz." });
        if (request.Amount <= 0)
            return BadRequest(new { message = "Geçerli bir tutar gir." });
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var from = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == request.FromAccountId && a.IsActive, ct);
        var to = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == request.ToAccountId && a.IsActive, ct);
        if (from is null || to is null)
            return BadRequest(new { message = "Hesaplardan biri bulunamadı." });
        from.Balance -= request.Amount;
        to.Balance += request.Amount;
        var note = string.IsNullOrWhiteSpace(request.Note) ? $"{from.Name} → {to.Name} virman" : request.Note.Trim();
        db.LedgerEntries.Add(new LedgerEntry
        {
            AccountId = from.Id,
            Type = "expense",
            Amount = request.Amount,
            NetAmount = request.Amount,
            Note = $"Virman çıkış: {note}",
            CreatedAt = DateTime.UtcNow
        });
        db.LedgerEntries.Add(new LedgerEntry
        {
            AccountId = to.Id,
            Type = "income",
            Amount = request.Amount,
            NetAmount = request.Amount,
            Note = $"Virman giriş: {note}",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return Ok(new { message = "Virman tamamlandı." });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Remove(int id, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var account = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (account is null) return NotFound();
        var used = await db.LedgerEntries.AnyAsync(e => e.AccountId == id, ct)
            || await db.CustomerPayments.AnyAsync(p => p.AccountId == id, ct)
            || await db.SupplierPayments.AnyAsync(p => p.AccountId == id, ct);
        if (used)
            account.IsActive = false;
        else
            db.CashAccounts.Remove(account);
        await db.SaveChangesAsync(ct);
        return Ok(new { message = used ? "Hesap geçmişi olduğu için kapatıldı." : "Hesap silindi." });
    }

    [HttpGet("{id:int}/movements")]
    public async Task<IActionResult> Movements(int id, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        var account = await db.CashAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct);
        if (account is null) return NotFound();
        var accounts = await db.CashAccounts.AsNoTracking().Where(a => a.IsActive).ToListAsync(ct);
        var cash = accounts.FirstOrDefault(a => a.Type == "cash") ?? accounts.FirstOrDefault();
        var card = accounts.FirstOrDefault(a => a.Type == "pos") ?? accounts.FirstOrDefault(a => a.Type == "bank") ?? cash;
        var rows = new List<Move>();

        if (cash?.Id == id || card?.Id == id)
        {
            var sales = await db.Sales.AsNoTracking().Where(s => s.PaymentMethod != PaymentMethod.Veresiye).OrderByDescending(s => s.SoldAt).Take(200).ToListAsync(ct);
            foreach (var sale in sales)
            {
                if (cash?.Id == id && sale.CashAmount > 0)
                    rows.Add(new Move(sale.SoldAt, "Satış nakit", sale.ReceiptNo, sale.CashAmount, "in"));
                if (card?.Id == id && sale.CardAmount > 0)
                    rows.Add(new Move(sale.SoldAt, "Satış POS", sale.ReceiptNo, sale.CardAmount, "in"));
            }
        }

        var ledger = await db.LedgerEntries.AsNoTracking().Where(e => e.AccountId == id).OrderByDescending(e => e.CreatedAt).Take(200).ToListAsync(ct);
        rows.AddRange(ledger.Select(e => new Move(e.CreatedAt, e.Type == "income" ? "Giriş" : "Çıkış", e.Note, e.Amount, e.Type == "income" ? "in" : "out")));
        var collected = await db.CustomerPayments.AsNoTracking().Where(p => p.AccountId == id).OrderByDescending(p => p.PaidAt).Take(100).ToListAsync(ct);
        rows.AddRange(collected.Select(p => new Move(p.PaidAt, "Tahsilat", p.Note, p.Amount, "in")));
        var paid = await db.SupplierPayments.AsNoTracking().Where(p => p.AccountId == id && p.Kind == "payment").OrderByDescending(p => p.PaidAt).Take(100).ToListAsync(ct);
        rows.AddRange(paid.Select(p => new Move(p.PaidAt, "Ödeme", p.Note, p.Amount, "out")));

        return Ok(rows.OrderByDescending(row => row.At).Take(200));
    }

    private sealed record Move(DateTime At, string Label, string? Note, decimal Amount, string Direction);
}
