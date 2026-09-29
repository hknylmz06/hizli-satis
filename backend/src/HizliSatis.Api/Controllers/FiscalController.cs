using System.Security.Claims;
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

public record FiscalPairResultRequest(
    bool Success,
    string? StatusMessage,
    string? SerialNo,
    string? HardwareId);

public record FiscalRegisterRequest(
    string? Name,
    string? Model,
    string? ConnectionType,
    string? DeviceHost,
    int DevicePort,
    string? ComPort,
    int BaudRate,
    string? SerialNo,
    string? SoftwareId,
    string? HardwareId,
    string? AgentBaseUrl,
    string? BridgeBaseUrl,
    int? UserId,
    bool IsEnabled);

[ApiController]
[Authorize(Roles = "TenantUser")]
[Route("api/fiscal")]
public class FiscalController(TenantDbContextFactory tenantDbFactory) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureDefinitionsAsync(db, ct);
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var autoReceipt = await AutoReceiptAsync(db, ct);
        var mine = await ResolveForUserAsync(db, CurrentUserId(), ct);
        if (mine is not null) return Ok(MapRegister(mine, autoReceipt));
        var fiscalRequired = autoReceipt && await db.FiscalRegisters.AsNoTracking().AnyAsync(x => x.IsEnabled, ct);
        return Ok(new
        {
            isEnabled = fiscalRequired,
            isPaired = false,
            deviceHost = "",
            model = "",
            needsAssignment = fiscalRequired,
            priceOnly = fiscalRequired
        });
    }

    [HttpGet("devices")]
    public async Task<IActionResult> ListDevices(CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var users = await db.Users.AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.DisplayName)
            .Select(u => new { u.Id, u.DisplayName, u.Username })
            .ToListAsync(ct);
        try
        {
            var devices = await db.FiscalRegisters.AsNoTracking().OrderBy(x => x.Id).ToListAsync(ct);
            return Ok(new { devices = devices.Select(MapRegister), users });
        }
        catch (Exception)
        {
            return Ok(new { devices = Array.Empty<object>(), users, message = "Yazarkasa listesi okunamadı. Sayfayı bir kez yenile." });
        }
    }

    [HttpPost("devices")]
    public async Task<IActionResult> CreateDevice([FromBody] FiscalRegisterRequest request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(new { message = error });

        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var row = new FiscalRegister();
        Apply(row, request);
        if (row.UserId is int userId)
            await ClearUserAsync(db, userId, null, ct);
        db.FiscalRegisters.Add(row);
        await db.SaveChangesAsync(ct);
        return Ok(MapRegister(row));
    }

    [HttpPut("devices/{id:int}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] FiscalRegisterRequest request, CancellationToken ct)
    {
        var error = Validate(request);
        if (error is not null) return BadRequest(new { message = error });

        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var row = await db.FiscalRegisters.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound(new { message = "Yazarkasa bulunamadı." });

        var targetChanged = !string.Equals(row.DeviceHost, request.DeviceHost?.Trim(), StringComparison.OrdinalIgnoreCase)
            || row.DevicePort != request.DevicePort
            || !string.Equals(row.Model, NormalizeModel(request.Model), StringComparison.OrdinalIgnoreCase)
            || !string.Equals(row.ConnectionType, NormalizeConnection(request.ConnectionType), StringComparison.OrdinalIgnoreCase)
            || !string.Equals(row.ComPort, Clean(request.ComPort), StringComparison.OrdinalIgnoreCase);

        Apply(row, request);
        if (targetChanged)
        {
            row.IsPaired = false;
            row.LastStatus = "Ayarlar güncellendi — eşleşmeyi tekrar test edin.";
            row.LastPairedAt = null;
        }
        if (row.UserId is int userId)
            await ClearUserAsync(db, userId, row.Id, ct);
        await db.SaveChangesAsync(ct);
        return Ok(MapRegister(row));
    }

    [HttpDelete("devices/{id:int}")]
    public async Task<IActionResult> DeleteDevice(int id, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var row = await db.FiscalRegisters.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound();
        db.FiscalRegisters.Remove(row);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("devices/{id:int}/pair-result")]
    public async Task<IActionResult> SaveDevicePair(int id, [FromBody] FiscalPairResultRequest request, CancellationToken ct)
    {
        await using var db = tenantDbFactory.Create();
        await TenantSchemaEnsuring.EnsureFiscalTableAsync(db, ct);
        var row = await db.FiscalRegisters.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return NotFound(new { message = "Yazarkasa bulunamadı." });
        ApplyPair(row, request);
        await db.SaveChangesAsync(ct);
        return Ok(MapRegister(row));
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
        if (!string.IsNullOrWhiteSpace(request.SerialNo))
            settings.SerialNo = request.SerialNo.Trim();
        if (!string.IsNullOrWhiteSpace(request.HardwareId))
            settings.HardwareId = request.HardwareId.Trim();

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

    private int CurrentUserId()
    {
        var raw = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(raw, out var id) ? id : 0;
    }

    private static async Task<FiscalRegister?> ResolveForUserAsync(TenantDbContext db, int userId, CancellationToken ct)
    {
        if (userId > 0)
        {
            var mine = await db.FiscalRegisters.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId && x.IsEnabled, ct);
            if (mine is not null) return mine;
        }

        var shared = await db.FiscalRegisters.AsNoTracking()
            .Where(x => x.IsEnabled && x.UserId == null)
            .ToListAsync(ct);
        return shared.Count == 1 ? shared[0] : null;
    }

    private static async Task ClearUserAsync(TenantDbContext db, int userId, int? keepId, CancellationToken ct)
    {
        var others = await db.FiscalRegisters.Where(x => x.UserId == userId && x.Id != keepId).ToListAsync(ct);
        foreach (var other in others)
            other.UserId = null;
    }

    private static string? Validate(FiscalRegisterRequest request)
    {
        var connection = NormalizeConnection(request.ConnectionType);
        if (connection == "IP" && string.IsNullOrWhiteSpace(request.DeviceHost))
            return "Yazarkasa IP adresi zorunlu.";
        if (connection == "COM" && string.IsNullOrWhiteSpace(request.ComPort))
            return "COM port zorunlu.";
        if (request.DevicePort is < 1 or > 65535)
            return "Port 1-65535 arasında olmalı.";
        return null;
    }

    private static void Apply(FiscalRegister row, FiscalRegisterRequest request)
    {
        var model = NormalizeModel(request.Model);
        var s1 = model.Contains("S1", StringComparison.OrdinalIgnoreCase);
        row.Name = string.IsNullOrWhiteSpace(request.Name) ? "Kasa" : request.Name.Trim();
        row.Model = model;
        row.ConnectionType = NormalizeConnection(request.ConnectionType);
        row.DeviceHost = request.DeviceHost?.Trim() ?? "";
        row.DevicePort = request.DevicePort > 0 ? request.DevicePort : (s1 ? 4443 : 4444);
        row.ComPort = Clean(request.ComPort) ?? "COM1";
        row.BaudRate = request.BaudRate > 0 ? request.BaudRate : 115200;
        row.SerialNo = Clean(request.SerialNo);
        row.SoftwareId = Clean(request.SoftwareId);
        row.HardwareId = Clean(request.HardwareId) ?? "ABCD1234";
        row.AgentBaseUrl = string.IsNullOrWhiteSpace(request.AgentBaseUrl)
            ? "http://127.0.0.1:5055"
            : request.AgentBaseUrl.Trim().TrimEnd('/');
        row.BridgeBaseUrl = string.IsNullOrWhiteSpace(request.BridgeBaseUrl)
            ? "http://127.0.0.1:8989"
            : request.BridgeBaseUrl.Trim().TrimEnd('/');
        row.UserId = request.UserId is > 0 ? request.UserId : null;
        row.IsEnabled = request.IsEnabled;
        row.UpdatedAt = DateTime.UtcNow;
    }

    private static void ApplyPair(FiscalRegister row, FiscalPairResultRequest request)
    {
        row.IsPaired = request.Success;
        row.LastStatus = request.StatusMessage;
        row.LastPairedAt = request.Success ? DateTime.UtcNow : row.LastPairedAt;
        row.UpdatedAt = DateTime.UtcNow;
        if (request.Success) row.IsEnabled = true;
        if (!string.IsNullOrWhiteSpace(request.SerialNo)) row.SerialNo = request.SerialNo.Trim();
        if (!string.IsNullOrWhiteSpace(request.HardwareId)) row.HardwareId = request.HardwareId.Trim();
    }

    private static string NormalizeModel(string? model)
    {
        var value = (model ?? "").Trim().ToUpperInvariant();
        if (value.Contains("T300")) return "HUGIN T300";
        if (value.Contains("FP-300") || value.Contains("FP300")) return "HUGIN FP-300";
        if (value.Contains("GENEL")) return "HUGIN GENEL";
        if (value.Contains("S1")) return "HUGIN S1";
        return string.IsNullOrWhiteSpace(model) ? "HUGIN S1" : model.Trim();
    }

    private static string NormalizeConnection(string? connection)
        => string.Equals(connection?.Trim(), "COM", StringComparison.OrdinalIgnoreCase) ? "COM" : "IP";

    private static string? Clean(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static async Task<bool> AutoReceiptAsync(TenantDbContext db, CancellationToken ct)
    {
        var value = await db.Settings.AsNoTracking().Select(s => (bool?)s.AutoFiscalReceipt).FirstOrDefaultAsync(ct);
        return value ?? true;
    }

    private static object MapRegister(FiscalRegister s) => MapRegister(s, null);

    private static object MapRegister(FiscalRegister s, bool? autoReceipt) => new
    {
        s.Id,
        s.Name,
        s.Model,
        s.ConnectionType,
        s.DeviceHost,
        s.DevicePort,
        s.ComPort,
        s.BaudRate,
        s.SerialNo,
        s.SoftwareId,
        s.HardwareId,
        s.AgentBaseUrl,
        s.BridgeBaseUrl,
        s.UserId,
        IsEnabled = autoReceipt ?? s.IsEnabled,
        s.IsPaired,
        s.LastStatus,
        s.LastPairedAt,
        s.UpdatedAt,
        DeviceBaseUrl = s.ConnectionType == "COM"
            ? s.ComPort
            : string.IsNullOrWhiteSpace(s.DeviceHost) ? null : $"https://{s.DeviceHost}:{s.DevicePort}"
    };

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
