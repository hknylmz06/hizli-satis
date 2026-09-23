using HizliSatis.Api.Contracts;
using HizliSatis.Domain.Tenant;
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
    public async Task<IActionResult> List(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var items = await db.Customers.AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        var customer = new Customer
        {
            Name = request.Name.Trim(),
            Phone = request.Phone?.Trim(),
            Note = request.Note?.Trim()
        };
        db.Customers.Add(customer);
        await db.SaveChangesAsync(ct);
        return Ok(customer);
    }

    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] CustomerPaymentRequest request, CancellationToken ct)
    {
        if (request.Amount <= 0)
            return BadRequest(new { message = "Ödeme tutarı 0'dan büyük olmalı." });

        await using var db = tenantDbFactory.Create();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound();

        customer.Balance -= request.Amount;
        db.CustomerPayments.Add(new CustomerPayment
        {
            CustomerId = customer.Id,
            Amount = request.Amount,
            Note = request.Note
        });
        await db.SaveChangesAsync(ct);

        return Ok(new { customer.Id, customer.Name, customer.Balance });
    }
}
