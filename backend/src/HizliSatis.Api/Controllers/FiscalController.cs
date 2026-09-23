using HizliSatis.Domain.Tenant;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using HizliSatis.Infrastructure.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

public record FiscalSettingsRequest(
    string DeviceHost,
    int DevicePort,
    string? SerialNo,
    string? SoftwareId,
    string? HardwareId,
    string? AgentBaseUrl,
    bool IsEnabled);

public record FiscalPairResultRequest(bool Success, string? StatusMessage);

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/fiscal")]
public class FiscalController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var settings = await GetOrCreateAsync(db, ct);
        return Ok(Map(settings));
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SaveSettings([FromBody] FiscalSettingsRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceHost))
            return BadRequest(new { message = "Yazarkasa IP / Host zorunlu." });

        if (request.DevicePort is < 1 or > 65535)
            return BadRequest(new { message = "Port 1-65535 arasında olmalı." });

        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var settings = await GetOrCreateAsync(db, ct);

        var hostChanged = !string.Equals(settings.DeviceHost, request.DeviceHost.Trim(), StringComparison.OrdinalIgnoreCase)
            || settings.DevicePort != request.DevicePort;

        settings.DeviceHost = request.DeviceHost.Trim();
        settings.DevicePort = request.DevicePort;
        settings.SerialNo = string.IsNullOrWhiteSpace(request.SerialNo) ? null : request.SerialNo.Trim();
        settings.SoftwareId = string.IsNullOrWhiteSpace(request.SoftwareId) ? null : request.SoftwareId.Trim();
        settings.HardwareId = string.IsNullOrWhiteSpace(request.HardwareId) ? null : request.HardwareId.Trim();
        settings.AgentBaseUrl = string.IsNullOrWhiteSpace(request.AgentBaseUrl)
            ? "http://127.0.0.1:5055"
            : request.AgentBaseUrl.Trim().TrimEnd('/');
        settings.IsEnabled = request.IsEnabled;
        settings.UpdatedAt = DateTime.UtcNow;

        if (hostChanged)
        {
            settings.IsPaired = false;
            settings.LastStatus = "Ayarlar güncellendi — eşleşmeyi tekrar test edin.";
            settings.LastPairedAt = null;
        }

        await db.SaveChangesAsync(ct);
        return Ok(Map(settings));
    }

    [HttpPost("pair-result")]
    public async Task<IActionResult> SavePairResult([FromBody] FiscalPairResultRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var settings = await GetOrCreateAsync(db, ct);

        settings.IsPaired = request.Success;
        settings.LastStatus = request.StatusMessage;
        settings.LastPairedAt = request.Success ? DateTime.UtcNow : settings.LastPairedAt;
        settings.UpdatedAt = DateTime.UtcNow;
        if (request.Success)
            settings.IsEnabled = true;

        await db.SaveChangesAsync(ct);
        return Ok(Map(settings));
    }

    private static async Task<FiscalDeviceSetting> GetOrCreateAsync(TenantDbContext db, CancellationToken ct)
    {
        var settings = await db.FiscalDevices.FirstOrDefaultAsync(ct);
        if (settings is not null)
            return settings;

        settings = new FiscalDeviceSetting();
        db.FiscalDevices.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }

    private static object Map(FiscalDeviceSetting s) => new
    {
        s.Provider,
        s.DeviceHost,
        s.DevicePort,
        s.SerialNo,
        s.SoftwareId,
        s.HardwareId,
        s.AgentBaseUrl,
        s.IsEnabled,
        s.IsPaired,
        s.LastStatus,
        s.LastPairedAt,
        s.UpdatedAt,
        DeviceBaseUrl = string.IsNullOrWhiteSpace(s.DeviceHost)
            ? null
            : $"https://{s.DeviceHost}:{s.DevicePort}"
    };
}
