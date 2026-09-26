using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Enums;
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
[Route("api/customers")]
public class CustomersController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? q, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var query = db.Customers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(c => c.Name.Contains(term) || (c.Phone != null && c.Phone.Contains(term)));
        }

        var items = await query.OrderBy(c => c.Name).Select(c => new
        {
            c.Id,
            c.Name,
            c.Phone,
            c.Email,
            c.Address,
            c.Note,
            c.CreditLimit,
            c.Balance
        }).ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Müşteri adı zorunlu." });

        await using var db = await Open(ct);
        var customer = new Customer
        {
            Name = request.Name.Trim(),
            Phone = Clean(request.Phone),
            Email = Clean(request.Email),
            Address = Clean(request.Address),
            Note = Clean(request.Note),
            CreditLimit = request.CreditLimit.GetValueOrDefault() < 0 ? 0 : request.CreditLimit.GetValueOrDefault()
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync(ct);
        return Ok(Map(customer));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateCustomerRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Müşteri adı zorunlu." });

        await using var db = await Open(ct);
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound(new { message = "Müşteri bulunamadı." });

        customer.Name = request.Name.Trim();
        customer.Phone = Clean(request.Phone);
        customer.Email = Clean(request.Email);
        customer.Address = Clean(request.Address);
        customer.Note = Clean(request.Note);
        customer.CreditLimit = request.CreditLimit.GetValueOrDefault() < 0 ? 0 : request.CreditLimit.GetValueOrDefault();
        await db.SaveChangesAsync(ct);
        return Ok(Map(customer));
    }

    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] CustomerPaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Ödeme tutarı 0'dan büyük olmalı." });
        if (request.AccountId is null)
            return BadRequest(new { message = "Paranın gireceği kasayı seç." });

        await using var db = await Open(ct);
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound(new { message = "Müşteri bulunamadı." });
        var account = await db.CashAccounts.FirstOrDefaultAsync(a => a.Id == request.AccountId && a.IsActive, ct);
        if (account is null) return BadRequest(new { message = "Kasa bulunamadı." });

        customer.Balance -= request.Amount;
        account.Balance += request.Amount;
        db.CustomerPayments.Add(new CustomerPayment
        {
            CustomerId = customer.Id,
            AccountId = account.Id,
            Amount = request.Amount,
            Kind = "payment",
            Note = Clean(request.Note) ?? $"Ödeme alındı · {account.Name}"
        });
        await db.SaveChangesAsync(ct);
        return Ok(Map(customer));
    }

    [HttpPost("{id:guid}/debt")]
    public async Task<IActionResult> AddDebt(Guid id, [FromBody] CustomerPaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Borç tutarı 0'dan büyük olmalı." });
        if (string.IsNullOrWhiteSpace(request.Note))
            return BadRequest(new { message = "Borç için açıklama yaz." });

        await using var db = await Open(ct);
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound(new { message = "Müşteri bulunamadı." });

        customer.Balance += request.Amount;
        db.CustomerPayments.Add(new CustomerPayment
        {
            CustomerId = customer.Id,
            Amount = request.Amount,
            Kind = "debt",
            Note = request.Note.Trim()
        });
        await db.SaveChangesAsync(ct);
        return Ok(Map(customer));
    }

    [HttpGet("{id:guid}/statement")]
    public async Task<IActionResult> Statement(Guid id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound(new { message = "Müşteri bulunamadı." });

        var sales = await db.Sales.AsNoTracking()
            .Where(s => s.CustomerId == id && s.PaymentMethod == PaymentMethod.Veresiye)
            .Select(s => new { s.Id, At = s.SoldAt, Kind = "sale", Amount = s.GrandTotal, Note = (string?)s.ReceiptNo })
            .ToListAsync(ct);
        var rows = await db.CustomerPayments.AsNoTracking()
            .Where(p => p.CustomerId == id)
            .Select(p => new { p.Id, At = p.PaidAt, Kind = p.Kind ?? "payment", p.Amount, p.Note, p.AccountId })
            .ToListAsync(ct);

        var accountNames = await db.CashAccounts.AsNoTracking().ToDictionaryAsync(a => a.Id, a => a.Name, ct);
        var ordered = sales.Select(x => new Move(x.Id, x.At, x.Kind, x.Amount, x.Note, null))
            .Concat(rows.Select(x => new Move(x.Id, x.At, x.Kind, x.Amount, x.Note, x.AccountId)))
            .OrderBy(x => x.At).ThenBy(x => x.Id)
            .ToList();
        decimal running = 0, totalSales = 0, totalPayments = 0;
        var transactions = new List<object>();
        foreach (var move in ordered)
        {
            var kind = move.Kind == "debt" ? "debt" : move.Kind == "sale" ? "sale" : "payment";
            if (kind == "payment")
            {
                running -= move.Amount;
                totalPayments += move.Amount;
            }
            else
            {
                running += move.Amount;
                if (kind == "sale") totalSales += move.Amount;
            }

            transactions.Add(new
            {
                move.Id,
                createdAt = move.At,
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
            customer = Map(customer),
            summary = new
            {
                currentBalance = customer.Balance,
                totalSales,
                totalPayments,
                creditLimit = customer.CreditLimit
            },
            transactions
        });
    }

    [HttpPost("{id:guid}/reminder")]
    public async Task<IActionResult> Reminder(Guid id, CancellationToken ct)
    {
        await using var db = await Open(ct);
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound(new { message = "Müşteri bulunamadı." });
        if (customer.Balance <= 0)
            return BadRequest(new { message = "Ödenmemiş veresiye borcu yok." });
        if (string.IsNullOrWhiteSpace(customer.Phone))
            return BadRequest(new { message = "Müşterinin telefonu yok." });

        var phone = new string(customer.Phone.Where(char.IsDigit).ToArray());
        if (phone.StartsWith('0')) phone = phone[1..];
        if (!phone.StartsWith("90")) phone = "90" + phone;

        var text = $"Sayın {customer.Name}, mağazamızda {customer.Balance:0.00} TL açık veresiye bakiyeniz bulunmaktadır. En kısa sürede ödeme yapmanızı rica ederiz.";
        var url = $"https://wa.me/{phone}?text={Uri.EscapeDataString(text)}";
        return Ok(new { whatsappUrl = url, messageText = text });
    }

    private async Task<TenantDbContext> Open(CancellationToken ct)
    {
        var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        return db;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static object Map(Customer customer) => new
    {
        customer.Id,
        customer.Name,
        customer.Phone,
        customer.Email,
        customer.Address,
        customer.Note,
        customer.CreditLimit,
        customer.Balance
    };

    private sealed record Move(Guid Id, DateTime At, string? Kind, decimal Amount, string? Note, Guid? AccountId);
}
