using HizliSatis.Api.Contracts;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin")]
[Route("api/admin/tenants")]
public class AdminTenantsController(
    MasterDbContext masterDb,
    TenantProvisioningService provisioning) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var items = await masterDb.Tenants
            .AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.FirmaKodu,
                t.ContactEmail,
                t.ContactPhone,
                t.DatabaseName,
                Status = t.Status.ToString(),
                t.LastError,
                t.InitialUsername,
                t.CreatedAt,
                t.ProvisionedAt
            })
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var tenant = await masterDb.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant is null) return NotFound();

        var notifications = await masterDb.NotificationLogs.AsNoTracking()
            .Where(n => n.TenantId == id)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new { n.Channel, n.Recipient, n.Subject, n.Body, n.Sent, n.CreatedAt })
            .ToListAsync(ct);

        return Ok(new
        {
            tenant.Id,
            tenant.Name,
            tenant.FirmaKodu,
            tenant.ContactEmail,
            tenant.ContactPhone,
            tenant.DatabaseName,
            Status = tenant.Status.ToString(),
            tenant.LastError,
            tenant.InitialUsername,
            tenant.InitialPasswordPlain,
            tenant.CreatedAt,
            tenant.ProvisionedAt,
            Notifications = notifications
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.ContactEmail))
            return BadRequest(new { message = "Firma adı ve e-posta zorunlu." });

        var tenant = await provisioning.RegisterAsync(
            request.Name,
            request.ContactEmail,
            request.ContactPhone,
            request.ProvisionNow,
            ct);

        return CreatedAtAction(nameof(Get), new { id = tenant.Id }, new
        {
            tenant.Id,
            tenant.Name,
            tenant.FirmaKodu,
            Status = tenant.Status.ToString(),
            tenant.InitialUsername,
            tenant.InitialPasswordPlain,
            tenant.DatabaseName
        });
    }

    [HttpPost("{id:guid}/provision")]
    public async Task<IActionResult> Provision(Guid id, CancellationToken ct)
    {
        var tenant = await provisioning.ProvisionAsync(id, ct);
        return Ok(new
        {
            tenant.Id,
            tenant.FirmaKodu,
            Status = tenant.Status.ToString(),
            tenant.InitialUsername,
            tenant.InitialPasswordPlain,
            tenant.LastError
        });
    }
}
