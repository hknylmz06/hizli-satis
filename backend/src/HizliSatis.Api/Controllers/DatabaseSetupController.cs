using System.Net;
using HizliSatis.Infrastructure.Persistence;
using HizliSatis.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HizliSatis.Api.Controllers;

public record DatabaseSettingsRequest(
    string Server,
    int Port,
    string MasterDatabase,
    string? User,
    string? Password);

[ApiController]
[Route("api/setup/database")]
public class DatabaseSetupController(
    SqlServerSettingsStore store,
    IServiceScopeFactory scopeFactory,
    ILogger<DatabaseSetupController> logger) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var s = store.Get();
        var (ok, message) = await store.TestAsync(s, ct);
        return Ok(View(s, ok, message));
    }

    [HttpPost("test")]
    [AllowAnonymous]
    public async Task<IActionResult> Test([FromBody] DatabaseSettingsRequest request, CancellationToken ct)
    {
        if (!CanConfigure())
            return StatusCode(403, new { message = "Sunucu ayarı sadece bu bilgisayardan veya platform admin girişinden değişir." });

        var (ok, message) = await store.TestAsync(ToSettings(request), ct);
        return Ok(new { ok, message });
    }

    [HttpPut]
    [AllowAnonymous]
    public async Task<IActionResult> Save([FromBody] DatabaseSettingsRequest request, CancellationToken ct)
    {
        if (!CanConfigure())
            return StatusCode(403, new { message = "Sunucu ayarı sadece bu bilgisayardan veya platform admin girişinden değişir." });

        var incoming = ToSettings(request);
        var (ok, message) = await store.TestAsync(incoming, ct);
        if (!ok)
            return BadRequest(new { ok = false, message });

        store.Save(incoming);

        try
        {
            await store.EnsureMasterDatabaseAsync(ct);
            using var scope = scopeFactory.CreateScope();
            var seeder = scope.ServiceProvider.GetRequiredService<MasterSeedService>();
            await seeder.InitializeAsync(ct);

            var db = scope.ServiceProvider.GetRequiredService<MasterDbContext>();
            var tenants = await db.Tenants.ToListAsync(ct);
            foreach (var tenant in tenants)
            {
                if (string.IsNullOrWhiteSpace(tenant.DatabaseName)) continue;
                tenant.ConnectionString = store.ForDatabase(tenant.DatabaseName);
            }

            if (tenants.Count > 0)
                await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "SQL Server kaydedildi ama şema kurulamadı");
            return Ok(new
            {
                ok = true,
                message = "Ayar kaydedildi ama veritabanı hazırlanamadı: " + ex.Message,
                settings = View(store.Get(), false, ex.Message)
            });
        }

        var saved = store.Get();
        var check = await store.TestAsync(saved, ct);
        return Ok(new
        {
            ok = true,
            message = "SQL Server kaydedildi. Platform girişi: admin / Admin123!",
            settings = View(saved, check.Ok, check.Message)
        });
    }

    private bool CanConfigure()
    {
        if (User.IsInRole("PlatformAdmin"))
            return true;

        var ip = HttpContext.Connection.RemoteIpAddress;
        if (ip is null) return false;
        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.IsIPv4MappedToIPv6 && IPAddress.IsLoopback(ip.MapToIPv4())) return true;
        return false;
    }

    private static SqlServerSettings ToSettings(DatabaseSettingsRequest request) => new()
    {
        Server = request.Server,
        Port = request.Port,
        MasterDatabase = request.MasterDatabase,
        User = request.User ?? "",
        Password = request.Password ?? ""
    };

    private static object View(SqlServerSettings s, bool connected, string message) => new
    {
        server = s.Server,
        port = s.Port,
        masterDatabase = s.MasterDatabase,
        user = s.User,
        hasPassword = !string.IsNullOrEmpty(s.Password),
        windowsAuth = string.IsNullOrWhiteSpace(s.User),
        connected,
        message
    };
}
